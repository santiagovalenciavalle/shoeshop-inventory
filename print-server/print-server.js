const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");

const PORT = 3000;

function detectarImpresora(callback) {
  const cmd = `powershell -NoProfile -Command "Get-WmiObject Win32_Printer | Select-Object -ExpandProperty Name"`;
  exec(cmd, (err, stdout) => {
    if (err || !stdout.trim()) {
      callback("4BARCODE 4B-2044C");
      return;
    }
    const impresoras = stdout
      .trim()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const keywords = [
      "4barcode",
      "4b-2044",
      "label",
      "thermal",
      "tsc",
      "zebra",
      "hprt",
      "xprinter",
      "barcode",
    ];
    const found = impresoras.find((p) =>
      keywords.some((k) => p.toLowerCase().includes(k)),
    );
    callback(found || impresoras[0] || "4BARCODE 4B-2044C");
  });
}

function printViaWinApi(printerName, tspl) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `lbl_${Date.now()}.prn`);
    fs.writeFileSync(tmpFile, Buffer.from(tspl, "binary"));

    const ps = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class WinPrint {
    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int level, IntPtr pDocInfo);
    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
}
'@

$printerName = "${printerName.replace(/"/g, "")}"
$bytes = [IO.File]::ReadAllBytes("${tmpFile.replace(/\\/g, "\\\\")}")

$hPrinter = [IntPtr]::Zero
if (-not [WinPrint]::OpenPrinter($printerName, [ref]$hPrinter, [IntPtr]::Zero)) {
    throw "OpenPrinter falló para: $printerName"
}

# Construir DOCINFO struct manualmente
$docName  = [Runtime.InteropServices.Marshal]::StringToHGlobalAnsi("TSPLLabel")
$dataType = [Runtime.InteropServices.Marshal]::StringToHGlobalAnsi("RAW")
$docInfo  = [Runtime.InteropServices.Marshal]::AllocHGlobal(24)
[Runtime.InteropServices.Marshal]::WriteIntPtr($docInfo, 0,  $docName)
[Runtime.InteropServices.Marshal]::WriteIntPtr($docInfo, 8,  [IntPtr]::Zero)
[Runtime.InteropServices.Marshal]::WriteIntPtr($docInfo, 16, $dataType)

[WinPrint]::StartDocPrinter($hPrinter, 1, $docInfo) | Out-Null
[WinPrint]::StartPagePrinter($hPrinter) | Out-Null

$ptr = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
[Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
$written = 0
$ok = [WinPrint]::WritePrinter($hPrinter, $ptr, $bytes.Length, [ref]$written)
[Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
[Runtime.InteropServices.Marshal]::FreeHGlobal($docInfo)
[Runtime.InteropServices.Marshal]::FreeHGlobal($docName)
[Runtime.InteropServices.Marshal]::FreeHGlobal($dataType)

[WinPrint]::EndPagePrinter($hPrinter) | Out-Null
[WinPrint]::EndDocPrinter($hPrinter) | Out-Null
[WinPrint]::ClosePrinter($hPrinter) | Out-Null

if (-not $ok) { throw "WritePrinter falló" }
Write-Output "OK:$written bytes escritos"
`;

    const psFile = tmpFile.replace(".prn", ".ps1");
    fs.writeFileSync(psFile, ps, "utf8");

    exec(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psFile}"`,
      { timeout: 15000 },
      (err, stdout, stderr) => {
        try {
          fs.unlinkSync(tmpFile);
        } catch {}
        try {
          fs.unlinkSync(psFile);
        } catch {}

        if (err) {
          console.error("❌ WinAPI error:", err.message);
          console.error("stderr:", stderr);
          reject(new Error(stderr || err.message));
        } else {
          resolve();
        }
      },
    );
  });
}

let PRINTER_NAME = process.env.PRINTER_NAME || "";

detectarImpresora((nombre) => {
  if (!PRINTER_NAME) PRINTER_NAME = nombre;

  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, printer: PRINTER_NAME }));
      return;
    }

    if (req.method === "GET" && req.url === "/printers") {
      const cmd = `powershell -NoProfile -Command "Get-WmiObject Win32_Printer | Select-Object Name,PortName,PrinterStatus | ConvertTo-Json"`;
      exec(cmd, (err, stdout) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        try {
          const data = JSON.parse(stdout);
          res.end(JSON.stringify(Array.isArray(data) ? data : [data]));
        } catch {
          res.end(JSON.stringify([]));
        }
      });
      return;
    }

    if (req.method === "GET" && req.url === "/test") {
      const tspl = [
        "SIZE 50 mm,38 mm",
        "GAP 3 mm,0 mm",
        "CLS",
        "DENSITY 12",
        `TEXT 10,10,"3",0,1,1,"PRUEBA USB OK"`,
        `TEXT 10,50,"2",0,1,1,"${PRINTER_NAME}"`,
        `TEXT 10,80,"2",0,1,1,"RAW Win32 OK"`,
        "PRINT 1,1",
        "",
      ].join("\r\n");

      printViaWinApi(PRINTER_NAME, tspl)
        .then(() => {
          res.writeHead(200);
          res.end("OK");
        })
        .catch((e) => {
          res.writeHead(500);
          res.end(e.message);
        });
      return;
    }

    if (req.method === "POST" && req.url === "/print") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const { tspl } = JSON.parse(body);
          if (!tspl) throw new Error("Campo 'tspl' requerido");
          await printViaWinApi(PRINTER_NAME, tspl);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          console.error("❌ /print error:", e.message);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(PORT, "127.0.0.1", () => {});
});

/// <reference types="web-bluetooth" />
/// <reference types="w3c-web-serial" />
import { Injectable, signal } from '@angular/core';
import {
  LabelTemplate,
  LabelElement,
  TextElement,
  BarcodeElement,
  QrElement,
  LineElement,
  RectElement,
  LabelVariables,
  mmToDots,
  resolveVariables,
} from '../printer-template/printer-template.service';

export type ConnectionType = 'bluetooth' | 'usb' | 'none';

export interface StickerData {
  marca: string;
  referencia: string;
  codigo: string;
  talla: string;
  local?: string;
  conCodigoBarras?: boolean;
  qrData?: string;
}

@Injectable({ providedIn: 'root' })
export class BluetoothPrinterService {
  isConnected = signal(false);
  deviceName = signal<string | null>(null);
  isConnecting = signal(false);
  error = signal<string | null>(null);
  connectionType = signal<ConnectionType>('none');

  private btDevice: BluetoothDevice | null = null;
  private btCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

  private readonly BT_SERVICES = [
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000fff0-0000-1000-8000-00805f9b34fb',
    '00001101-0000-1000-8000-00805f9b34fb',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    '0000fee0-0000-1000-8000-00805f9b34fb',
  ];

  private readonly BT_CHARS = [
    '0000ff02-0000-1000-8000-00805f9b34fb',
    '0000ff01-0000-1000-8000-00805f9b34fb',
    '0000fff2-0000-1000-8000-00805f9b34fb',
    '0000fff1-0000-1000-8000-00805f9b34fb',
    '00002af1-0000-1000-8000-00805f9b34fb',
    '49535343-8841-43f4-a8d4-ecbe34729bb3',
    'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
  ];

  private serialPort: SerialPort | null = null;
  private serialWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;

  async connectBluetooth(): Promise<boolean> {
    this.isConnecting.set(true);
    this.error.set(null);
    try {
      this.btDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: this.BT_SERVICES,
      });

      this.deviceName.set(this.btDevice.name ?? 'Impresora BT');
      this.btDevice.addEventListener('gattserverdisconnected', () => {
        this.isConnected.set(false);
        this.connectionType.set('none');
        this.btCharacteristic = null;
      });

      const server = await this.btDevice.gatt!.connect();

      let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

      for (const serviceUUID of this.BT_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUUID);
          for (const charUUID of this.BT_CHARS) {
            try {
              const c = await service.getCharacteristic(charUUID);
              if (c.properties.write || c.properties.writeWithoutResponse) {
                characteristic = c;
                break;
              }
            } catch {}
          }
          if (characteristic) break;
        } catch {}
      }

      if (!characteristic) {
        const services = await server.getPrimaryServices();
        for (const service of services) {
          try {
            const chars = await service.getCharacteristics();
            for (const c of chars) {
              if (c.properties.write || c.properties.writeWithoutResponse) {
                characteristic = c;

                break;
              }
            }
          } catch {}
          if (characteristic) break;
        }
      }

      if (!characteristic)
        throw new Error(
          'No se encontró característica de escritura en este dispositivo',
        );

      this.btCharacteristic = characteristic;
      this.isConnected.set(true);
      this.connectionType.set('bluetooth');
      return true;
    } catch (err: any) {
      this.error.set(err.message ?? 'Error de conexión Bluetooth');
      this.isConnected.set(false);
      return false;
    } finally {
      this.isConnecting.set(false);
    }
  }

  async connectUSB(): Promise<boolean> {
    this.isConnecting.set(true);
    this.error.set(null);
    try {
      const res = await fetch('http://localhost:3000/health');
      if (!res.ok) throw new Error('Sin respuesta');

      const data = await res.json();
      this.isConnected.set(true);
      this.connectionType.set('usb');
      this.deviceName.set(`🔌 ${data.printer}`);
      return true;
    } catch {
      this.error.set('Servidor no encontrado. Ejecuta start.bat primero.');
      this.isConnected.set(false);
      return false;
    } finally {
      this.isConnecting.set(false);
    }
  }

  async disconnect(): Promise<void> {
    if (this.btDevice?.gatt?.connected) {
      this.btDevice.gatt.disconnect();
    }
    this.btCharacteristic = null;
    this.btDevice = null;

    try {
      this.serialWriter?.releaseLock();
      await this.serialPort?.close();
    } catch {}
    this.serialWriter = null;
    this.serialPort = null;

    this.isConnected.set(false);
    this.connectionType.set('none');
    this.deviceName.set(null);
  }

  async sendData(data: Uint8Array): Promise<void> {
    const type = this.connectionType();

    if (type === 'bluetooth') {
      await this.sendBluetooth(data);
    } else if (type === 'usb') {
      await this.sendSerial(data);
    } else {
      throw new Error('Sin conexión activa');
    }
  }

  private async sendBluetooth(data: Uint8Array): Promise<void> {
    if (!this.btCharacteristic) throw new Error('Sin conexión Bluetooth');
    const CHUNK = 20;
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk = data.slice(i, i + CHUNK);
      try {
        await this.btCharacteristic.writeValueWithoutResponse(chunk);
      } catch {
        await this.btCharacteristic.writeValue(chunk);
      }
      await this.delay(30);
    }
  }

  private async sendSerial(data: Uint8Array): Promise<void> {
    const tspl = new TextDecoder().decode(data);
    const res = await fetch('http://localhost:3000/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tspl }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Error al imprimir por USB');
    }
  }

  async printMultiple(
    template: LabelTemplate,
    itemsVars: LabelVariables[],
  ): Promise<void> {
    const cols = Math.max(1, template.cols);
    for (let i = 0; i < itemsVars.length; i += cols) {
      const rowItems = itemsVars.slice(i, i + cols);
      const tspl = this.generateTsplMultiCol(template, rowItems);
      await this.sendData(new TextEncoder().encode(tspl));
      await this.delay(600);
    }
  }

  generateTspl(template: LabelTemplate, vars: LabelVariables): string {
    const lines: string[] = [
      `SIZE ${template.width} mm,${template.height} mm`,
      `GAP ${template.gap} mm,0 mm`,
      'CLS',
      'DENSITY 12',
    ];

    const visibles = template.elements?.filter((el) => el.visible) ?? [];

    for (const el of visibles) {
      lines.push(...this.elementToTspl(el, vars, 0));
    }

    lines.push('PRINT 1,1', '');
    return lines.join('\r\n');
  }

  generateTsplMultiCol(
    template: LabelTemplate,
    rowItems: LabelVariables[],
  ): string {
    const totalCols = Math.max(1, template.cols);
    const totalWidthMm = template.width * totalCols;
    const colWidthDots = mmToDots(template.width);

    const lines: string[] = [
      `SIZE ${totalWidthMm} mm,${template.height} mm`,
      `GAP ${template.gap} mm,0 mm`,
      'CLS',
      'DENSITY 12',
    ];

    const visibles = template.elements?.filter((el) => el.visible) ?? [];

    for (let col = 0; col < totalCols; col++) {
      const vars = rowItems[col];
      if (!vars) continue;
      const offsetX = col * colWidthDots;
      for (const el of visibles) {
        lines.push(...this.elementToTspl(el, vars, offsetX));
      }
    }

    lines.push('PRINT 1,1', '');
    return lines.join('\r\n');
  }

  async printLabel(
    template: LabelTemplate,
    vars: LabelVariables,
  ): Promise<void> {
    const tspl = this.generateTspl(template, vars);
    const encoded = new TextEncoder().encode(tspl);
    for (let i = 0; i < (template.copies || 1); i++) {
      await this.sendData(encoded);
      if (i < (template.copies || 1) - 1) await this.delay(800);
    }
  }

  async printExhibicion(
    data: Omit<StickerData, 'local'>,
    locales: string[],
    template: LabelTemplate,
  ): Promise<void> {
    const allVars: LabelVariables[] = locales.map((local) => ({
      marca: data.marca,
      referencia: data.referencia,
      codigo: data.codigo,
      talla: data.talla,
      local,
    }));
    await this.printMultiple(template, allVars);
  }

  async printCalibration(): Promise<void> {
    const tspl = [
      'SIZE 50 mm,30 mm',
      'GAP 3 mm,0 mm',
      'CLS',
      'DENSITY 12',
      `BAR ${mmToDots(10)},0,3,${mmToDots(30)}`,
      `BAR ${mmToDots(25)},0,3,${mmToDots(30)}`,
      `BAR ${mmToDots(40)},0,3,${mmToDots(30)}`,
      `TEXT 0,0,"2",0,1,1,"0"`,
      `TEXT ${mmToDots(10)},${mmToDots(15)},"2",0,1,1,"10mm"`,
      `TEXT ${mmToDots(25)},${mmToDots(15)},"2",0,1,1,"25mm"`,
      `TEXT ${mmToDots(40)},${mmToDots(15)},"2",0,1,1,"40mm"`,
      'PRINT 1,1',
      '',
    ].join('\r\n');
    await this.sendData(new TextEncoder().encode(tspl));
  }

  private elementToTspl(
    el: LabelElement,
    vars: LabelVariables,
    offsetX: number,
  ): string[] {
    const xd = offsetX + mmToDots(el.x);
    const yd = mmToDots(el.y);
    switch (el.type) {
      case 'text':
        return this.textToTspl(el as TextElement, vars, xd, yd);
      case 'barcode':
        return this.barcodeToTspl(el as BarcodeElement, vars, xd, yd);
      case 'qr':
        return this.qrToTspl(el as QrElement, vars, xd, yd);
      case 'line':
        return this.lineToTspl(el as LineElement, xd, yd);
      case 'rect':
        return this.rectToTspl(el as RectElement, xd, yd);
      default:
        return [];
    }
  }

  private textToTspl(
    el: TextElement,
    vars: LabelVariables,
    x: number,
    y: number,
  ): string[] {
    const text = resolveVariables(el.content, vars).replace(/"/g, "'");
    if (!text) return [];
    const cmds: string[] = [];
    if (el.bold) cmds.push('BOLD 1');
    cmds.push(
      `TEXT ${x},${y},"${el.fontCode}",0,${el.scaleX},${el.scaleY},"${text}"`,
    );
    if (el.bold) cmds.push('BOLD 0');
    return cmds;
  }

  private barcodeToTspl(
    el: BarcodeElement,
    vars: LabelVariables,
    x: number,
    y: number,
  ): string[] {
    const value = resolveVariables(el.content, vars).replace(/"/g, "'");
    if (!value) return [];
    return [
      `BARCODE ${x},${y},"${el.barcodeType}",${mmToDots(el.height)},${el.showText ? 1 : 0},0,${el.narrow ?? 2},${(el.narrow ?? 2) * 2},"${value}"`,
    ];
  }

  private qrToTspl(
    el: QrElement,
    vars: LabelVariables,
    x: number,
    y: number,
  ): string[] {
    const value = resolveVariables(el.content, vars).replace(/"/g, "'");
    if (!value) return [];
    return [`QRCODE ${x},${y},L,${el.moduleSize},A,0,"${value}"`];
  }

  private lineToTspl(el: LineElement, x: number, y: number): string[] {
    const w = el.direction === 'h' ? mmToDots(el.width) : el.thickness;
    const h = el.direction === 'h' ? el.thickness : mmToDots(el.width);
    return [`BAR ${x},${y},${w},${h}`];
  }

  private rectToTspl(el: RectElement, x: number, y: number): string[] {
    return [
      `BOX ${x},${y},${x + mmToDots(el.width)},${y + mmToDots(el.height)},${el.thickness}`,
    ];
  }

  async printSticker(data: StickerData, config: any): Promise<void> {
    const vars: LabelVariables = {
      marca: data.marca,
      referencia: data.referencia,
      codigo: data.codigo,
      talla: data.talla,
      local: data.local,
    };
    const template: LabelTemplate = {
      nombre: 'legacy',
      width: config.width ?? 50,
      height: config.height ?? 30,
      gap: config.gap ?? 3,
      cols: config.cols ?? 1,
      copies: config.copies ?? 1,
      elements: config.elements ?? [],
    };
    await this.printLabel(template, vars);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

import { Injectable, inject, signal } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from '@angular/fire/firestore';

export type TsplFont = '1' | '2' | '3' | '4' | '5';

export const FONT_DOTS: Record<TsplFont, { w: number; h: number }> = {
  '1': { w: 8, h: 16 },
  '2': { w: 10, h: 20 },
  '3': { w: 12, h: 24 },
  '4': { w: 16, h: 32 },
  '5': { w: 24, h: 48 },
};

export const DPM = 8;

export type ElementType = 'text' | 'barcode' | 'qr' | 'line' | 'rect';

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  visible: boolean;
  locked: boolean;
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  fontCode: TsplFont;
  scaleX: number;
  scaleY: number;
  bold: boolean;
}

export interface BarcodeElement extends BaseElement {
  type: 'barcode';
  content: string;
  barcodeType: 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8';
  height: number;
  showText: boolean;
  narrow: number;
}

export interface QrElement extends BaseElement {
  type: 'qr';
  content: string;
  moduleSize: number;
}

export interface LineElement extends BaseElement {
  type: 'line';
  width: number;
  thickness: number;
  direction: 'h' | 'v';
}

export interface RectElement extends BaseElement {
  type: 'rect';
  width: number;
  height: number;
  thickness: number;
}

export type LabelElement =
  | TextElement
  | BarcodeElement
  | QrElement
  | LineElement
  | RectElement;

export interface LabelVariables {
  marca?: string;
  referencia?: string;
  talla?: string;
  codigo?: string;
  local?: string;
  precio?: string;
  custom1?: string;
  custom2?: string;
  custom3?: string;
}

export const AVAILABLE_VARIABLES: {
  key: keyof LabelVariables;
  label: string;
}[] = [
  { key: 'marca', label: 'Marca' },
  { key: 'referencia', label: 'Referencia' },
  { key: 'talla', label: 'Talla' },
  { key: 'codigo', label: 'Código' },
  { key: 'local', label: 'Local' },
  { key: 'precio', label: 'Precio' },
  { key: 'custom1', label: 'Custom 1' },
  { key: 'custom2', label: 'Custom 2' },
  { key: 'custom3', label: 'Custom 3' },
];

export interface LabelTemplate {
  id?: string;
  nombre: string;
  width: number;
  height: number;
  gap: number;
  cols: number;
  copies: number;
  elements: LabelElement[];
  marginTop?: number;
  marginLeft?: number;
  fontSize?: number;
  rotation?: 0 | 90 | 180 | 270;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  createdAt?: number;
  updatedAt?: number;
}

export type PrinterTemplate = LabelTemplate;

export interface LabelConfig {
  width: number;
  height: number;
  gap: number;
  marginTop: number;
  marginLeft: number;
  fontSize: number;
  copies: number;
  rotation: 0 | 90 | 180 | 270;
  bold: boolean;
  align: 'left' | 'center' | 'right';
  cols: number;
}

export const DEFAULT_LABEL_CONFIG: LabelConfig = {
  width: 50,
  height: 30,
  gap: 3,
  marginTop: 0,
  marginLeft: 0,
  fontSize: 12,
  copies: 1,
  rotation: 0,
  bold: true,
  align: 'left',
  cols: 2,
};

export function mmToDots(mm: number): number {
  return Math.round(mm * DPM);
}

export function dotsToMm(dots: number): number {
  return dots / DPM;
}

export function resolveVariables(text: string, vars: LabelVariables): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return (vars as any)[key] ?? `{{${key}}}`;
  });
}

export function textWidthMm(el: TextElement, text: string): number {
  return (FONT_DOTS[el.fontCode].w * el.scaleX * text.length) / DPM;
}

export function textHeightMm(el: TextElement): number {
  return (FONT_DOTS[el.fontCode].h * el.scaleY) / DPM;
}

export function qrSizeMm(el: QrElement): number {
  return (el.moduleSize * 33) / DPM;
}

let _idCounter = 0;
export function newId(): string {
  return `el_${Date.now()}_${_idCounter++}`;
}

export function defaultElements(
  widthMm: number,
  heightMm: number,
): LabelElement[] {
  return [
    {
      id: newId(),
      type: 'text',
      visible: true,
      locked: false,
      x: 1,
      y: 1,
      content: '{{marca}}',
      fontCode: '3',
      scaleX: 1,
      scaleY: 1,
      bold: true,
    } as TextElement,
    {
      id: newId(),
      type: 'text',
      visible: true,
      locked: false,
      x: 1,
      y: 5,
      content: '{{referencia}}',
      fontCode: '2',
      scaleX: 1,
      scaleY: 1,
      bold: false,
    } as TextElement,
    {
      id: newId(),
      type: 'text',
      visible: true,
      locked: false,
      x: widthMm * 0.6,
      y: 1,
      content: '{{talla}}',
      fontCode: '4',
      scaleX: 2,
      scaleY: 2,
      bold: true,
    } as TextElement,
    {
      id: newId(),
      type: 'text',
      visible: true,
      locked: false,
      x: 1,
      y: 10,
      content: 'C{{codigo}}',
      fontCode: '2',
      scaleX: 1,
      scaleY: 1,
      bold: false,
    } as TextElement,
    {
      id: newId(),
      type: 'line',
      visible: true,
      locked: false,
      x: 1,
      y: heightMm - 8,
      width: widthMm - 2,
      thickness: 2,
      direction: 'h',
    } as LineElement,
    {
      id: newId(),
      type: 'text',
      visible: true,
      locked: false,
      x: 1,
      y: heightMm - 6,
      content: '{{local}}',
      fontCode: '2',
      scaleX: 1,
      scaleY: 1,
      bold: false,
    } as TextElement,
    {
      id: newId(),
      type: 'qr',
      visible: true,
      locked: false,
      x: widthMm * 0.6,
      y: heightMm - 14,
      content: '{{codigo}}',
      moduleSize: 3,
    } as QrElement,
  ];
}

const SESSION_KEY = 'label_template_active_v2';

@Injectable({ providedIn: 'root' })
export class PrinterTemplateService {
  private firestore = inject(Firestore);
  private colRef = collection(this.firestore, 'label_templates_v2');

  templates = signal<LabelTemplate[]>([]);
  activeTemplate = signal<LabelTemplate | null>(this.loadFromSession());

  private loadFromSession(): LabelTemplate | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private saveToSession(t: LabelTemplate): void {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(t));
  }

  setActiveTemplate(t: LabelTemplate): void {
    this.activeTemplate.set(t);
    this.saveToSession(t);
  }

  async loadTemplates(): Promise<void> {
    const snap = await getDocs(this.colRef);
    this.templates.set(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LabelTemplate),
    );
  }

  async saveTemplate(t: Omit<LabelTemplate, 'id'>): Promise<LabelTemplate> {
    const data = { ...t, createdAt: Date.now(), updatedAt: Date.now() };
    const ref = await addDoc(this.colRef, data);
    const saved = { id: ref.id, ...data };
    this.templates.update((list) => [...list, saved]);
    return saved;
  }

  async updateTemplate(t: LabelTemplate): Promise<void> {
    if (!t.id) return;
    const { id, ...data } = { ...t, updatedAt: Date.now() };
    await updateDoc(doc(this.firestore, 'label_templates_v2', id), data as any);
    this.templates.update((list) => list.map((x) => (x.id === id ? t : x)));
    if (this.activeTemplate()?.id === id) {
      this.activeTemplate.set(t);
      this.saveToSession(t);
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'label_templates_v2', id));
    this.templates.update((list) => list.filter((x) => x.id !== id));
    if (this.activeTemplate()?.id === id) {
      this.activeTemplate.set(null);
      sessionStorage.removeItem(SESSION_KEY);
    }
  }
}

import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Output,
  Input,
  ChangeDetectorRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { Products } from '../../../pages/interfaces';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from '@angular/fire/storage';
import { Storage } from '@angular/fire/storage';

@Component({
  selector: 'app-modal-agregar-producto',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    ButtonModule,
    ToastModule,
  ],
  templateUrl: './modal-agregar-producto.component.html',
  styleUrls: ['./modal-agregar-producto.component.css'],
  providers: [MessageService],
})
export class ModalAgregarProductoComponent {
  @Input() editable: boolean = true;
  @Input() admin = false;

  loading: boolean = false;
  pendingFile?: File;

  @Input() producto: Products = {
    marca: '',
    referencia: '',
    imagen: '',
    id: 0,
    tallasDisponibles: {},
    precioAdquisicion: null,
    precioMin: null,
    pl: '0',
    fila: '',
  };

  @Output() productoAgregado = new EventEmitter<Products>();
  @Output() close = new EventEmitter<void>();

  constructor(
    private messageService: MessageService,
    private storage: Storage,
    private cd: ChangeDetectorRef,
  ) {}

  handleNativeImageUpload(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;
    this.pendingFile = file;
    if (file.type.includes('heic') || file.type.includes('heif')) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Formato no soportado',
        detail: 'El formato HEIC no puede ser procesado.',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.producto.imagen = e.target.result;
      this.cd.markForCheck();
      setTimeout(() => this.cd.detectChanges(), 0);
    };
    reader.readAsDataURL(file);
  }

  base64ToFile(base64: string, filename: string): File {
    const arr = base64.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : '';
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    return new File([u8arr], filename, { type: mime });
  }

  async compressAndUploadImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;
          if (width > height && width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          } else if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            async (blob) => {
              if (!blob) return reject('No se pudo generar blob');
              try {
                const filePath = `productos/${Date.now()}_${file.name}`;
                const fileRef = ref(this.storage, filePath);
                const snapshot = await uploadBytes(fileRef, blob);
                const downloadURL = await getDownloadURL(snapshot.ref);
                resolve(downloadURL);
              } catch (error) {
                reject(error);
              }
            },
            'image/jpeg',
            0.7,
          );
        };
      };
      reader.readAsDataURL(file);
    });
  }

  cerrarModal() {
    this.close.emit();
  }

  get totalTallasIngresadas(): number {
    return Object.values(this.producto.tallasDisponibles || {}).reduce(
      (acc, val) => acc + (val || 0),
      0,
    );
  }

  objectKeys(obj: { [key: number]: number }): number[] {
    return Object.keys(obj).map((key) => Number(key));
  }

  async guardarProducto() {
    if (!this.producto.marca || !this.producto.referencia) {
      this.messageService.add({
        severity: 'error',
        summary: 'Campos incompletos',
        detail: 'Debe completar Marca y Referencia.',
      });
      return;
    }
    this.loading = true;
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      if (this.pendingFile) {
        if (
          this.producto.imagen?.startsWith(
            'https://firebasestorage.googleapis.com',
          )
        ) {
          await this.borrarImagenAnterior(this.producto.imagen);
        }
        this.producto.imagen = await this.compressAndUploadImage(
          this.pendingFile,
        );
        this.pendingFile = undefined;
      } else if (this.producto.imagen?.startsWith('data:image')) {
        const fileFromBase64 = this.base64ToFile(
          this.producto.imagen,
          `imagen_${Date.now()}.jpg`,
        );
        this.producto.imagen =
          await this.compressAndUploadImage(fileFromBase64);
      }
    } catch (error) {
      console.error(error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error al subir imagen',
        detail: 'Intente nuevamente.',
      });
      return;
    } finally {
      this.loading = false;
    }

    if (!this.admin) {
      this.producto.precioAdquisicion = null;
      this.producto.precioMin =
        this.producto.precioMin === 0 ? null : this.producto.precioMin;
    }

    if (!this.producto.fila || this.producto.fila.trim() === '') {
      this.producto.fila = 'X';
    }

    this.productoAgregado.emit(this.producto);

    this.producto = {
      marca: '',
      referencia: '',
      imagen: '',
      id: 0,
      tallasDisponibles: {},
      precioAdquisicion: null,
      precioMin: null,
      fila: '',
      pl: '',
    };
  }

  async borrarImagenAnterior(url: string) {
    if (!url) return;
    try {
      const decodedUrl = decodeURIComponent(url);
      const baseUrl =
        'https://firebasestorage.googleapis.com/v0/b/your-project-id.appspot.com/o/';
      if (!decodedUrl.startsWith(baseUrl)) return;
      const pathStart = baseUrl.length;
      const pathEnd = decodedUrl.indexOf('?alt=media');
      const filePath = decodedUrl.substring(pathStart, pathEnd);
      const fileRef = ref(this.storage, filePath);
      await deleteObject(fileRef);
    } catch (error) {
      console.warn('No se pudo borrar la imagen anterior:', error);
    }
  }
}

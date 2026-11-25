import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FileUploadModule } from 'primeng/fileupload';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-add-new-ref-almacen',
  standalone: true,
  imports: [
    FormsModule,
    FileUploadModule,
    InputTextModule,
    ButtonModule,
    CommonModule,
  ],
  templateUrl: './add-new-ref-almacen.component.html',
  styleUrl: './add-new-ref-almacen.component.css',
})
export class AddNewRefAlmacenComponent {
  @Output() referenciaGuardada = new EventEmitter<any>();
  @Output() close = new EventEmitter<any>();

  referencia = '';
  marca = '';
  local = '';
  imagenPreview: string | ArrayBuffer | null = null;
  formInvalido = false;

  tallas = this.generarTallas();

  get totalUnidades(): number {
    return this.tallas.reduce(
      (sum, talla) => sum + (Number(talla.cantidad) || 0),
      0
    );
  }

  onUpload(event: any): void {
    const file: File = event.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.imagenPreview = reader.result;
      };
      reader.readAsDataURL(file);
    }
  }

  guardarReferencia() {
    if (!this.referencia.trim() || !this.marca.trim() || !this.local.trim()) {
      this.formInvalido = true;
      return;
    }

    const nuevoProducto = {
      id: crypto.randomUUID(),
      referencia: this.referencia,
      marca: this.marca,
      imagen: this.imagenPreview,
      tallas: this.tallas,
      total: this.totalUnidades,
      local: this.local,
    };

    this.referenciaGuardada.emit(nuevoProducto);
    this.resetFormulario();
  }

  resetFormulario() {
    this.referencia = '';
    this.marca = '';
    this.imagenPreview = null;
    this.tallas = this.generarTallas();
    this.formInvalido = false;
  }

  generarTallas() {
    return Array.from({ length: 11 }, (_, i) => ({
      numero: 35 + i,
      cantidad: 0,
    }));
  }

  onCancel() {
    this.resetFormulario();
    this.close.emit();
  }
}

import {
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { Bono } from '../../../../interfaces';
import { BonosService } from '../../../../../services/vendedorServices/bonos/bonos.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'app-modal-bono',
  imports: [
    DialogModule,
    InputTextModule,
    ButtonModule,
    ToastModule,
    InputNumberModule,
    FormsModule,
    SelectModule,
    CommonModule,
  ],
  templateUrl: './modal-bono.component.html',
  styleUrl: './modal-bono.component.css',
  providers: [MessageService],
})
export class ModalBonoComponent {
  codigoBono = '';
  bonoEncontrado: Bono | null = null;
  excedente?: number;
  @Input() display: boolean = false;
  @Output() cerrar = new EventEmitter<void>();
  @Output() bonoRedimido = new EventEmitter<any>();
  metodos = [
    { nombre: 'Efectivo', valor: 'efectivo' },
    { nombre: 'Transferencia', valor: 'transferencia' },
  ];
  metodoSeleccionado: any;

  constructor(
    private bonosService: BonosService,
    private messageService: MessageService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['display']) {
    }
  }

  async buscarBono() {
    if (!this.codigoBono.trim()) return;

    const bono = await this.bonosService.buscarBonoPorId(
      this.codigoBono.trim()
    );

    if (bono) {
      this.bonoEncontrado = bono;
      this.excedente = undefined;
    } else {
      this.bonoEncontrado = null;
      this.messageService.add({
        severity: 'warn',
        summary: 'No encontrado',
        detail: `No se encontró un bono con el código ${this.codigoBono}`,
      });
    }
  }

  limpiarCampos() {
    this.codigoBono = '';
    this.bonoEncontrado = null;
    this.excedente = undefined;
  }

  redimirBono() {
    if (!this.bonoEncontrado) return;

    const bonoEnviado = {
      bono: this.bonoEncontrado,
      excedente: this.excedente,
      metodo: this.metodoSeleccionado?.valor ?? null,
    };

    this.bonoRedimido.emit(bonoEnviado);
    this.limpiarCampos();
    this.display = false;
    this.cerrar.emit();
  }
}

import { Pipe, PipeTransform } from '@angular/core';
import { exhibiciones } from '../../../pages/interfaces';

function extractLocalNumber(nombre: string): string {
  const match = nombre.match(/\d+/);
  return match ? match[0] : nombre.trim();
}

@Pipe({
  name: 'mieLocalCount',
  standalone: true,
})
export class MieLocalCountPipe implements PipeTransform {
  transform(exhibiciones: exhibiciones[], localNum: string): number {
    return exhibiciones.filter((ex) =>
      (ex.locales ?? []).some((l) => extractLocalNumber(l) === localNum),
    ).length;
  }
}

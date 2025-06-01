/**
 * @component ChangePasswordComponent
 * @description Componente standalone para alterar a password do utilizador.
 * Utiliza formulário reativo para validar campos e comunica com o serviço ClientService.
 */
import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ClientService } from '../../services/client/client.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-password.component.html',
})
export class ChangePasswordComponent {
  /** FormControlGroup para campos de alteração de password */
  form: FormGroup;

  /**
   * @constructor
   * @param fb FormBuilder para criar o FormGroup reativo
   * @param client Serviço de cliente para chamada de API de alteração de password
   */
  constructor(private fb: FormBuilder, private client: ClientService) {
    // Inicializa o formulário com validações e validador customizado
    this.form = this.fb.group(
      {
        currentPassword: ['', Validators.required],
        newPassword: ['', [Validators.required, Validators.minLength(6)]],
        confirm: ['', Validators.required],
      },
      { validators: this.matchPasswords }
    );
  }
    /** Mensagem de erro exibida em caso de falha na submissão */
  error: string | null = null;
    /** Flag que indica se a alteração foi bem-sucedida */
  success = false;

  /**
   * Validador customizado para garantir que 'newPassword' e 'confirm' correspondam.
   * @param formGroup Grupo de formulários a validar
   * @returns null se as passwords corresponderem, objeto de erro caso contrário
   */
  matchPasswords(g: any) {
    return g.get('newPassword')!.value === g.get('confirm')!.value
      ? null
      : { mismatch: true };
  }

  /**
   * Handler de submissão do formulário.
   * Executa chamada ao serviço para alterar password e atualiza flags de sucesso ou erro.
   */
  onSubmit() {
    if (this.form.invalid) return;
    this.error = null;
    this.success = false;
    const current = this.form.get('currentPassword')!.value as string;
    const next = this.form.get('newPassword')!.value as string;

    this.client.changePassword(current, next).subscribe({
      next: () => {
        this.error = null;
        this.success = true;
      },
      error: (err) => {
        this.success = false;
        this.error = err.error?.error || 'Falha ao mudar password';
      },
    });
  }
}

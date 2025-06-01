/**
 * @component RegisterComponent
 * @description Componente standalone para o registo de novos utilizadores.
 *  - Coleta dados do formulário (email, password, nome, NIF, contacto e moradas)
 *  - Valida necessidade de campo "companyName" com base no NIF
 *  - Envia payload ao serviço de autenticação e navega para dashboard após sucesso
 */
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AuthRestService,
  RegisterPayload,
} from '../../services/auth/auth-rest-service.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
})
export class RegisterComponent {
  /** Email do utilizador */
  email = '';
  /** Password do utilizador */
  password = '';
  /** Nome completo do utilizador */
  name = '';
   /** NIF (Número de Identificação Fiscal) */
  nif = '';
  /** Nome da empresa, se aplicável */
  companyName = '';
  /** Número de contacto do utilizador */
  contact = '';

  /** Morada de faturação */
  address = { street: '', postalCode: '', city: '', country: 'Portugal' };
  /** Flag que indica se a morada de entrega é igual à de faturação */
  isDeliverySame = true;
  /** Morada de entrega quando diferente da de faturação */
  deliveryAddress = {
    street: '',
    postalCode: '',
    city: '',
    country: 'Portugal',
  };

  /** Mensagem de erro para exibir falhas de registo */
  error: string | null = null;

  /**
   * @constructor
   * @param auth Serviço de autenticação para chamadas de registo/login
   * @param router Router do Angular para navegação após registo bem-sucedido
   */
  constructor(private auth: AuthRestService, private router: Router) {}

  /**
   * Determina se o campo companyName é obrigatório.
   * Baseia-se no primeiro dígito do NIF (5-6-8 indicam empresa).
   * @returns true se for necessário fornecer companyName, false caso contrário
   */
  get needsCompanyName(): boolean {
    return !!this.nif && /^[568]/.test(this.nif);
  }

  /**
   * Handler de submissão do formulário de registo.
   * Monta o payload e chama auth.register; trata resposta ou erro.
   */
  onSubmit(): void {
    this.error = null;
    const payload: RegisterPayload = {
      email: this.email,
      password: this.password,
      name: this.name,
      nif: this.nif,
      companyName: this.companyName || undefined,
      contact: this.contact,
      address: this.address,
      isDeliverySame: this.isDeliverySame,
      deliveryAddress: this.isDeliverySame
        ? this.address
        : this.deliveryAddress,
    };

    this.auth.register(payload).subscribe({
      next: (res) => {
        // Armazena token e navega para o dashboard
        this.auth.setToken(res.token);
        this.router.navigate(['/']);
      },
      error: (err) => {
        // Trata falha de registo exibindo mensagem de erro
        this.error = err.error?.error || 'Falha no registo';
      },
    });
  }
}

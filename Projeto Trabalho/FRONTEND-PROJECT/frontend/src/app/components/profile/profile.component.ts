/**
 * @component ProfileComponent
 * @description Componente standalone para gestão do perfil de cliente:
 *  - Mostra e edita dados do perfil
 *  - Permite alterar password e visualizar histórico de encomendas
 *  - Gere logout do utilizador
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ClientService, ClientProfile } from '../../services/client/client.service';
import { OrdersHistoryComponent } from '../orders-history/orders-history.component';
import { ChangePasswordComponent } from '../change-password/change-password.component';
import { AuthRestService } from '../../services/auth/auth-rest-service.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    OrdersHistoryComponent,
    ChangePasswordComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit {
  /** Objeto que contém os dados do perfil do cliente */
  profile!: ClientProfile;
  /** Mensagem de erro para exibir falhas de carregamento ou atualização */
  error: string | null = null;
  /** FormGroup ou modelo para edição inline dos campos de perfil */
  profileForm: any;

  /** Flag que controla exibição do painel de alteração de password */
  showChangePw = false;

  /**
   * @constructor
   * @param client Serviço para chamadas de perfil de cliente (get/update)
   * @param authService Serviço de autenticação para logout
   * @param router Router para navegação programática
   */
  constructor(
    private client: ClientService,
    private authService: AuthRestService,
    public router: Router
  ) {}

  /**
   * Lifecycle hook: carrega dados do perfil quando o componente é inicializado
   */
  ngOnInit() {
    this.loadProfile();
  }

  /**
   * Carrega o perfil do cliente do backend e trata erros
   */
  loadProfile() {
    this.client.getProfile().subscribe({
      next: (p) => (this.profile = p),
      error: (err) => {
        this.error = 'Erro ao carregar perfil';
        console.error(err);
      },
    });
  }

  /**
   * Envia as alterações do perfil ao backend e atualiza state local
   */
  onSave() {
    this.error = null;
    const update = {
      name: this.profile.name,
      email: this.profile.email,
      nif: this.profile.nif,
      contact: this.profile.contact,
      address: this.profile.address,
      deliveryAddress: this.profile.deliveryAddress,
    };
    this.client.updateProfile(update).subscribe({
      next: (updated) => {
        this.profile = updated;
        alert('Perfil atualizado com sucesso!');
      },
      error: (err) => {
        this.error = 'Erro ao atualizar perfil';
        console.error(err);
      },
    });
  }

  /**
   * Exibe o componente de alteração de password
   */
  openChangePassword() {
    this.showChangePw = true;
  }

  /**
   * Fecha o componente de alteração de password
   */
  closeChangePassword() {
    this.showChangePw = false;
  }

  /**
   * Efetua logout do utilizador e redireciona para a homepage
   */
  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}

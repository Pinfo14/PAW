/**
 * @injectable
 * @description Guardião de rotas para proteger componentes que requerem autenticação.
 * Implementa CanActivate para verificar existência de token JWT; se ausente, redireciona para login.
 */
import { Injectable } from '@angular/core';
import {
  CanActivate,
  Router,
  UrlTree,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthRestService } from '../services/auth/auth-rest-service.service';


@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  /**
   * @constructor
   * @param authService Serviço de autenticação para verificar token
   * @param router Router para navegação caso não autenticado
   */
  constructor(private authService: AuthRestService, private router: Router) {}

  /**
   * Método chamado pelo Angular Router para determinar se a rota pode ser ativada.
   * Verifica token no AuthRestService e retorna true se existir.
   * Caso contrário, cria UrlTree que redireciona para /login com queryParams.
   *
   * @param route Snapshot da rota a ativar
   * @param state Snapshot do estado do router contendo URL de retorno
   * @returns true para permitir ativação ou UrlTree para redirecionar
   */
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean | UrlTree {
    const token = this.authService.getToken();
    if (token) {
      return true;
    }
    // Redireciona para login com returnUrl atualizado para navegar de volta após autenticação
    return this.router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }
}

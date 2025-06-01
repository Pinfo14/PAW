/**
 * @injectable
 * @description Intercepta requisições HTTP para adicionar token de autenticação
 * e lida com erros de autorização (401/403) efetuando logout e redirecionamento.
 */
import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, Observable, throwError } from 'rxjs';
import { AuthRestService } from '../services/auth/auth-rest-service.service';


@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  /**
   * @constructor
   * @param authService Serviço de autenticação para obter token e realizar logout
   * @param router Router para navegação em caso de erro de autorização
   */
  constructor(private authService: AuthRestService, private router: Router) {}

  /**
   * Intercepta todas as requisições HTTP:
   * - Se houver token, clona a requisição adicionando cabeçalho Authorization
   * - Encadeia o próximo handler
   * - Em caso de erro 401 ou 403, efetua logout e redireciona para homepage
   * @param req Requisição HTTP original
   * @param next Handler para continuar a cadeia de interceptores/requisições
   * @returns Observable com o evento HTTP ou erro repassado
   */
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Obtém token JWT armazenado
    const token = this.authService.getToken();

    // Se existir token, clona requisição adicionando cabeçalho
    let authReq = req;
    if (token) {
      authReq = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
    }
    // Continua a cadeia de handlers e trata erros de autorização
    return next.handle(authReq).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401 || err.status === 403) {
          // Limpa estado de autenticação e redireciona para raiz
          this.authService.logout();
          this.router.navigate(['/']);
        }
         // Repassa erro para componentes/subscritores
         return throwError(() => err);
      })
    );
  }
}

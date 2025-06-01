/**
 * @component CommentFormComponent
 * @description Componente standalone para submeter comentários de clientes a um restaurante,
 * permitindo texto e até 3 imagens, com validações de tamanho e tipo.
 */
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CommentsService } from '../../services/comments/comments.service';

@Component({
  selector: 'app-comment-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './comment-form.component.html',
})
export class CommentFormComponent {
   /**
   * ID do restaurante ao qual o comentário será associado
   */
  @Input() restaurantId!: string;

  /**
   * Emite evento quando o comentário for submetido com sucesso
   */
  @Output() submitted = new EventEmitter<void>();

  /**
   * Emite evento quando o utilizador cancelou o formulário
   */
  @Output() cancelled = new EventEmitter<void>();

  /** Grupo de controles do formulário (campo de texto) */
  form: FormGroup;
  /** Flag de loading durante submissão */
  loading = false;
  /** Mensagem de erro genérica do formulário */
  error: string | null = null;

  /** Lista de ficheiros selecionados pelo utilizador */
  selectedFiles: File[] = [];
  /** Array de URLs base64 para preview das imagens */
  previews: string[] = [];
  /** Mensagem de erro específica de ficheiros */
  fileError: string | null = null;
  /** Máximo de imagens permitidas */
  readonly MAX_FILES = 3;
  /** Tamanho máximo por ficheiro em MB */
  readonly MAX_SIZE_MB = 5;

   /**
   * @constructor
   * @param fb FormBuilder para criar o FormGroup reativo
   * @param commentService Serviço para submeter comentários à API
   */
  constructor(
    private fb: FormBuilder,
    private commentService: CommentsService
  ) {
    // Inicializa o formulário com validação de campo obrigatório e limite de caracteres
    this.form = this.fb.group({
      text: ['', [Validators.required, Validators.maxLength(1000)]],
    });
  }

  /**
   * Handler para seleção de ficheiros de imagem.
   * Faz validações de quantidade, tamanho e tipo, gera previews.
   * @param evt Evento de seleção de ficheiros do input
   */
  onFilesSelected(evt: Event) {
    this.fileError = null;
    const files = Array.from((evt.target as HTMLInputElement).files || []);
    // Valida número máximo de ficheiros
    if (files.length > this.MAX_FILES) {
      this.fileError = `Só podes enviar até ${this.MAX_FILES} imagens.`;
      return;
    }
    // Valida tamanho e tipo de cada ficheiro
    for (const f of files) {
      if (f.size > this.MAX_SIZE_MB * 1024 * 1024) {
        this.fileError = `Cada ficheiro deve ter até ${this.MAX_SIZE_MB} MB.`;
        return;
      }
      if (!f.type.startsWith('image/')) {
        this.fileError = `Tipo inválido: ${f.name}`;
        return;
      }
    }
    // Armazena ficheiros e gera previews base64
    this.selectedFiles = files;
    this.previews = [];
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => this.previews.push(reader.result as string);
      reader.readAsDataURL(f);
    });
  }

    /**
   * Converte um File em Data URL (base64)
   * @param file Ficheiro a ler
   * @returns Promise que resolve com string base64
   */
  private readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Submete o comentário ao serviço:
   * 1. Valida formulário e erros de ficheiro
   * 2. Converte imagens em base64
   * 3. Chama CommentsService.create
   * 4. Emite eventos submitted/cancelled conforme resultado
   */
  submit() {
    // Se formulário inválido ou erro de ficheiro, destaca erros
    if (this.form.invalid || this.fileError) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.error = null;

    // Converte todas as imagens selecionadas em base64
    const readPromises = this.selectedFiles.map((f) =>
      this.readFileAsDataURL(f)
    );

    Promise.all(readPromises)
      .then((base64Array: string[]) => {
        const payload = {
          text: this.form.value.text,
          restaurantId: this.restaurantId,
          images: base64Array,
        };
        // Submete comentário via serviço
        this.commentService.create(payload).subscribe({
          next: () => {
            this.loading = false;
            this.submitted.emit();
            this.form.reset();
            this.selectedFiles = [];
            this.previews = [];
          },
          error: () => {
            this.loading = false;
            this.error = 'Erro ao enviar comentário.';
          },
        });
      })
      .catch(() => {
        this.loading = false;
        this.error = 'Erro a ler as imagens.';
      });
  }
}

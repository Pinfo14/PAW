/**
 * @fileoverview Configuração de SSE (Server-Sent Events) para emitir atualizações de encomendas.
 * Fornece função para montar rota de stream e instância de EventEmitter para emitir eventos.
 */
// Importa EventEmitter do Node.js para gerenciar eventos
const { EventEmitter } = require("events");
// Instância compartilhada para emitir eventos 'order-updated'
const emitter = new EventEmitter();

/**
 * Monta endpoint de SSE no objeto Express (app ou router).
 * Configura cabeçalhos necessários e escuta eventos para envio de dados ao cliente.
 *
 * @param {import('express').Application|import('express').Router} appOrRouter - App ou Router Express onde a rota será montada.
 */
function mountSse(appOrRouter) {
  appOrRouter.get("/api/orders/stream", (req, res) => {
    // Define cabeçalhos SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no",
    });
    res.write("\n");

    /**
     * Handler para eventos 'order-updated'.
     * Formata payload e envia como SSE para o cliente.
     *
     * @param {Object|{type:string,order:Object}} data - Dados do evento ou payload completo.
     */
    const onUpdate = (data) => {
      // Se data já contém type e order, usa payload diretamente, caso contrário cria novo
      const payload =
        data && data.type && data.order
          ? data
          : { type: "order-updated", order: data };

      // Envia evento SSE com payload JSON
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      if (res.flush) res.flush();
    };

    // Regista listener para eventos de atualização de encomenda
    emitter.on("order-updated", onUpdate);

    // Remove listener quando conexão fecha
    req.on("close", () => {
      emitter.off("order-updated", onUpdate);
    });
  });
}
// Exporta instância de emitter e função para montar SSE
module.exports = { emitter, mountSse };

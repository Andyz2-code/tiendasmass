import React, { useState, useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { useBranch } from '../context/BranchContext';
import api from '../services/api';
import {
  Sparkles,
  ShoppingBag,
  Plus,
  X,
  Send,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Tag
} from 'lucide-react';

export const ChatbotCartAssistant = () => {
  const { cart, addToCart } = useCart();
  const { selectedBranch } = useBranch();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: '¡Hola! Soy Massi, tu asistente de ahorro en Tiendas Mass. ¿Deseas que te recomiende complementos u ofertas para tu compra?'
    }
  ]);
  const [recommendations, setRecommendations] = useState([]);
  const [inputText, setInputText] = useState('');
  const [addedIds, setAddedIds] = useState({});
  const messagesEndRef = useRef(null);

  // Auto-scroll al recibir un nuevo mensaje
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Si el carrito cambia y el chatbot está abierto, podemos ofrecer nuevas recomendaciones
  const solicitarRecomendaciones = async (mensajeUsuario = '') => {
    if (!cart || cart.length === 0) return;

    setLoading(true);
    try {
      const sucursalId = selectedBranch?.id || 1;
      const res = await api.post('/chat/recommendations', {
        sucursal_id: sucursalId,
        cart_items: cart,
        message: mensajeUsuario
      });

      const data = res.data;
      if (data && data.success && data.data) {
        const payload = data.data;
        if (mensajeUsuario && mensajeUsuario !== 'Recomiéndame complementos') {
          setMessages((prev) => [...prev, { sender: 'user', text: mensajeUsuario }]);
        }
        if (payload.mensaje_ia) {
          setMessages((prev) => [
            ...prev,
            {
              sender: 'bot',
              text: payload.mensaje_ia,
              motivo: payload.motivo
            }
          ]);
        }
        if (Array.isArray(payload.productos)) {
          setRecommendations(payload.productos);
        }
      }
    } catch (err) {
      console.error('Error al conectar con Massi:', err);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'No pude conectar con el servidor en este momento, pero puedes seguir agregando productos con total normalidad.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const txt = inputText.trim();
    setInputText('');
    void solicitarRecomendaciones(txt);
  };

  const handleQuickQuestion = (question) => {
    void solicitarRecomendaciones(question);
  };

  const handleAddProduct = (prod) => {
    // Convertir a estructura canónica que espera addToCart
    const prodObj = {
      ...prod,
      precio_venta: prod.precio_venta || prod.precio || 0,
      stock_actual: prod.stock_actual || prod.stock || 10
    };
    addToCart(prodObj, 1);
    setAddedIds((prev) => ({ ...prev, [prod.id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [prod.id]: false }));
    }, 2000);
  };

  if (!cart || cart.length === 0) {
    return null;
  }

  return (
    <div className="w-full mt-3 font-sans">
      {/* Botón de apertura / cabecera compacta */}
      {!isOpen ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            if (recommendations.length === 0) {
              void solicitarRecomendaciones('Recomiéndame complementos');
            }
          }}
          className="w-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-black py-2.5 px-3.5 rounded-xl shadow-sm border border-amber-300 flex items-center justify-between transition-all duration-200 active:scale-98"
          aria-expanded={isOpen}
          aria-label="Abrir asistente inteligente de ahorro Massi"
        >
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-yellow-300 flex items-center justify-center text-xs shadow-inner shrink-0">
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-yellow-400" />
            </span>
            <div className="text-left">
              <p className="text-xs font-extrabold leading-tight">Massi – Asistente de Ahorro</p>
              <p className="text-[10px] font-medium text-stone-800">¿Qué complementos convienen con tu compra?</p>
            </div>
          </div>
          <span className="bg-stone-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
            Abrir IA
          </span>
        </button>
      ) : (
        /* Panel expandido del asistente */
        <div
          className="bg-amber-50/90 rounded-2xl border-2 border-amber-300 p-3 shadow-md space-y-2.5 transition-all animate-fadeIn"
          role="region"
          aria-label="Asistente de compras Massi"
        >
          {/* Header del Chatbot */}
          <div className="flex items-center justify-between border-b border-amber-200 pb-2">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-full bg-stone-900 text-yellow-400 flex items-center justify-center font-black text-xs shadow">
                M
              </div>
              <div>
                <h4 className="text-xs font-black text-stone-900 leading-tight flex items-center gap-1">
                  <span>Massi – Asistente de Ahorro</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="En línea"></span>
                </h4>
                <p className="text-[10px] text-stone-600">Recomendaciones con stock en {selectedBranch?.nombre || 'Huancayo'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-stone-500 hover:text-stone-900 hover:bg-amber-200/60 rounded-lg transition"
              aria-label="Minimizar asistente"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          {/* Historial de conversación */}
          <div className="max-h-44 overflow-y-auto space-y-2 pr-1 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl leading-relaxed text-[11px] ${
                  m.sender === 'user'
                    ? 'bg-amber-200/90 text-stone-900 ml-6 text-right font-medium'
                    : 'bg-white text-stone-900 mr-4 shadow-2xs border border-amber-200/80 font-normal'
                }`}
              >
                {m.text}
              </div>
            ))}

            {loading && (
              <div className="flex items-center space-x-2 text-[11px] text-stone-600 bg-white/80 p-2 rounded-xl border border-amber-100">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                <span>Massi está consultando el catálogo y ofertas...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Preguntas rápidas sugeridas */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[10px]">
            <button
              type="button"
              onClick={() => handleQuickQuestion('¿Qué combina con lo que llevo?')}
              className="bg-white hover:bg-amber-100 text-stone-800 font-semibold px-2 py-1 rounded-lg border border-amber-200 shrink-0 transition"
            >
              💡 ¿Qué combina?
            </button>
            <button
              type="button"
              onClick={() => handleQuickQuestion('¿Tienes opciones más económicas?')}
              className="bg-white hover:bg-amber-100 text-stone-800 font-semibold px-2 py-1 rounded-lg border border-amber-200 shrink-0 transition"
            >
              💰 Más económico
            </button>
            <button
              type="button"
              onClick={() => handleQuickQuestion('¿Qué me falta para cocinar un almuerzo?')}
              className="bg-white hover:bg-amber-100 text-stone-800 font-semibold px-2 py-1 rounded-lg border border-amber-200 shrink-0 transition"
            >
              🍲 Para almuerzo
            </button>
          </div>

          {/* Lista de productos recomendados con One-Click Add */}
          {recommendations.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-700 flex items-center gap-1">
                <Tag className="w-3 h-3 text-amber-600" />
                <span>Productos sugeridos con stock:</span>
              </span>

              <div className="grid grid-cols-1 gap-1.5">
                {recommendations.map((p) => {
                  const price = Number.parseFloat(p.precio_venta || p.precio || 0).toFixed(2);
                  const isAdded = !!addedIds[p.id];
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between bg-white p-2 rounded-xl border border-amber-200/90 shadow-2xs hover:border-amber-400 transition"
                    >
                      <div className="flex items-center space-x-2 min-w-0 pr-2">
                        <img
                          src={p.imagen_url || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=100'}
                          alt={p.nombre}
                          className="w-9 h-9 object-cover rounded-lg bg-stone-50 border border-stone-200 shrink-0"
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=100';
                          }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 truncate">{p.nombre}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-mass-red">S/. {price}</span>
                            <span className="text-[9px] bg-stone-100 text-stone-600 px-1 py-0.2 rounded font-semibold">
                              Stock: {p.stock_actual || p.stock || 1}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddProduct(p)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center space-x-1 shrink-0 transition ${
                          isAdded
                            ? 'bg-emerald-600 text-white'
                            : 'bg-mass-yellow hover:bg-yellow-400 text-stone-950 active:scale-95 shadow-2xs'
                        }`}
                        title="Agregar producto al carrito"
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>¡Listo!</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Agregar</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Formulario de entrada de texto */}
          <form onSubmit={handleSubmit} className="flex items-center gap-1.5 pt-1">
            <input
              type="text"
              id="massi_chat_input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Pregúntale a Massi (ej: ¿Tienes atún?)..."
              disabled={loading}
              className="flex-1 bg-white border border-stone-300 rounded-xl px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
              aria-label="Escribe tu consulta para el asistente Massi"
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-yellow-400 p-2 rounded-xl transition shrink-0 shadow-sm"
              aria-label="Enviar consulta"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatbotCartAssistant;

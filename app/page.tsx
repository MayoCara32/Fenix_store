'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, Coffee, Flag, LoaderCircle, Minus, Pause, Play, Plus, RefreshCw, ShoppingBag, X } from 'lucide-react';
import type { PaymentMethod, Product } from '@/lib/types';
import { lineTotal } from '@/lib/pricing';

const money = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(value);
const savedNameKey = 'fenix-customer-name';

function ProductArt({ product, index }: { product: Product; index: number }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const showImage = product.image && failedImage !== product.image;
  return <div className={`product-art ${showImage ? 'has-image' : ''}`}>
    {showImage ? <Image src={product.image!} alt={product.name} fill sizes="(max-width: 640px) 50vw, (max-width: 900px) 33vw, 25vw" className={`product-image ${product.id === 'F_03' ? 'product-image-rotated' : ''}`} onError={() => setFailedImage(product.image ?? null)}/> : <Coffee className="product-icon" size={58} strokeWidth={1.2}/>}
    <div className="product-art-top"><span className={`stock-label ${!product.stock ? 'stock-empty' : ''}`}><span/> {product.stock > 0 ? 'DISPONIBLE' : 'AGOTADO'}</span><span className="product-number">{String(index + 1).padStart(2, '0')}</span></div>
    {!showImage && <span className="product-art-caption">TIENDA / F?NIX</span>}
  </div>;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const touchStartX = useRef<number | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [carouselInteracting, setCarouselInteracting] = useState(false);
  const [carouselFocused, setCarouselFocused] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<{ total: number; saleId: string; paymentMethod: PaymentMethod } | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const res = await fetch('/api/products', { cache: 'no-store' }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setProducts(data.products); setRecommendations(data.recommendations ?? []); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos cargar el catálogo.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (carouselPaused || carouselInteracting || carouselFocused || open || success || recommendations.length < 2) return;
    const timer = window.setInterval(() => {
      if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      setCarouselIndex(index => (index + 1) % recommendations.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [carouselPaused, carouselInteracting, carouselFocused, open, success, recommendations.length]);
  useEffect(() => {
    try { setName(localStorage.getItem(savedNameKey) ?? ''); } catch { /* El navegador puede bloquear el almacenamiento. */ }
  }, []);
  useEffect(() => {
    if (!open || sending) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, sending]);
  const selected = useMemo(() => products.filter(p => cart[p.id] > 0), [products, cart]);
  const recommendedProducts = recommendations.flatMap(id => { const product = products.find(p => p.id === id); return product ? [product] : []; });
  const activeIndex = recommendedProducts.length ? carouselIndex % recommendedProducts.length : 0;
  const featured = recommendedProducts[activeIndex];
  function moveCarousel(direction: number) {
    setCarouselIndex(index => (index + direction + recommendedProducts.length) % recommendedProducts.length);
  }
  const categories = useMemo(() => {
    const normalize = (category: string) => category.trim().toLocaleLowerCase('es');
    return [
      { title: 'Comida', products: products.filter(p => normalize(p.category) === 'comida') },
      { title: 'Dulces', products: products.filter(p => normalize(p.category) === 'dulces') },
      { title: 'Botana', products: products.filter(p => normalize(p.category) === 'botana') },
      { title: 'Otros productos', products: products.filter(p => !['comida', 'dulces', 'botana'].includes(normalize(p.category))) },
    ].filter(group => group.title !== 'Otros productos' || group.products.length > 0);
  }, [products]);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = selected.reduce((sum, p) => sum + Math.round(lineTotal(p, cart[p.id]) * 100), 0) / 100;
  function change(product: Product, amount: number) {
    setCart(current => ({ ...current, [product.id]: Math.max(0, Math.min(product.stock, (current[product.id] || 0) + amount)) }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSending(true); setError('');
    try {
      const res = await fetch('/api/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, paymentMethod, expectedTotal: total, items: selected.map(p => ({ id: p.id, quantity: cart[p.id] })) }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      try { localStorage.setItem(savedNameKey, name.trim()); } catch { /* La compra sigue funcionando sin almacenamiento. */ }
      setName(name.trim());
      setSuccess(data); setCart({}); setOpen(false); void load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Ocurrió un error.'); }
    finally { setSending(false); }
  }
  return <main id="inicio">
    <header className="site-header">
      <div className="container header-inner">
        <a className="brand-link" href="#inicio" aria-label="Escudería Fénix, inicio"><Image src="/brand/fenix-horizontal.png" alt="Escudería Fénix" width={5907} height={1773} priority /></a>
        <div className="header-right"><a href="#catalogo" className="header-nav">Productos <ArrowDown size={14}/></a><span className="header-divider"/><span className="service-label"><span className="status-dot"/> Autoservicio <span className="service-extra">del taller</span></span></div>
      </div>
    </header>

    <section className="hero">
      <div className="hero-lines" aria-hidden="true" />
      <div className="container hero-inner">
        <div className="hero-copy"><p className="kicker hero-kicker"><span className="slash"/> ESCUDERÍA FÉNIX <span className="kicker-separator">/</span> TIENDA DEL TALLER</p><h1>UNA PAUSA.<br/><span>MÁS ENERGÍA.</span></h1><p className="hero-description">Algo rico para seguir creando. Elige tu antojo, regístralo y continúa con tu día.</p><a className="button button-orange" href="#catalogo">EXPLORAR PRODUCTOS <ArrowRight size={18}/></a></div>
        <div className="hero-visual" aria-hidden="true"><span className="visual-index">01 / FÉNIX</span><div className="visual-mark"><Image src="/brand/fenix-symbol.png" alt="" width={2953} height={2953} priority /></div><div className="visual-caption"><span>IMPULSO PARA<br/>EL EQUIPO</span><span className="caption-bars">{'///'}</span></div></div>
      </div>
      <div className="hero-bottom"><div className="container hero-bottom-inner"><span><Flag size={14}/> TU PARADA EN EL TALLER</span><span>ELIGE <b>/</b> REGISTRA <b>/</b> DISFRUTA</span></div></div>
    </section>

    <section id="catalogo" className="catalog container">
      <div className="section-heading"><div><p className="kicker section-kicker"><span className="slash"/> LA TIENDITA DEL TALLER</p><h2>ELIGE TU <span>ANTOJO.</span></h2><p className="section-description">Pequeños gustos para acompañar tu día.</p></div><div className="section-number" aria-hidden="true">01 <span>/</span> CATÁLOGO</div></div>
      {!loading && !error && featured && <section className="recommendations" aria-labelledby="recommendations-title" aria-roledescription="carrusel" onMouseEnter={() => setCarouselInteracting(true)} onMouseLeave={() => setCarouselInteracting(false)} onFocusCapture={() => setCarouselFocused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setCarouselFocused(false); }}>
        <div className="recommendations-heading"><div><p className="kicker section-kicker"><span className="slash"/> SELECCI?N DEL D?A</p><h3 id="recommendations-title">DESTACADOS PARA TI</h3><p>Una selecci?n diaria de los favoritos m?s vendidos.</p></div><div className="recommendation-controls">
          <button type="button" aria-label={carouselPaused ? 'Reanudar desplazamiento autom?tico' : 'Pausar desplazamiento autom?tico'} onClick={() => setCarouselPaused(value => !value)}>{carouselPaused ? <Play size={18}/> : <Pause size={18}/>}</button>
          <button type="button" aria-label="Producto anterior" aria-controls="recommendations-list" onClick={() => moveCarousel(-1)}><ArrowLeft size={18}/></button>
          <button type="button" aria-label="Producto siguiente" aria-controls="recommendations-list" onClick={() => moveCarousel(1)}><ArrowRight size={18}/></button>
        </div></div>
        <div className="coverflow" id="recommendations-list" aria-label="Productos recomendados" onTouchStart={e => { touchStartX.current = e.touches[0].clientX; setCarouselInteracting(true); }} onTouchEnd={e => { if (touchStartX.current !== null) { const delta = e.changedTouches[0].clientX - touchStartX.current; if (Math.abs(delta) > 40) { e.preventDefault(); moveCarousel(delta < 0 ? 1 : -1); } } touchStartX.current = null; setCarouselInteracting(false); }} onTouchCancel={() => { touchStartX.current = null; setCarouselInteracting(false); }}>
          {recommendedProducts.map((p, index) => {
            let offset = (index - activeIndex + recommendedProducts.length) % recommendedProducts.length;
            if (offset > recommendedProducts.length / 2) offset -= recommendedProducts.length;
            return <button type="button" className={`coverflow-card coverflow-position-${offset + 2}`} key={p.id} aria-label={`Ver ${p.name}`} aria-current={offset === 0 ? 'true' : undefined} onClick={() => setCarouselIndex(index)}><ProductArt product={p} index={index}/></button>;
          })}
        </div>
        <div className="featured-details" aria-live="off"><div><span className="featured-counter">{String(activeIndex + 1).padStart(2, '0')} / {String(recommendedProducts.length).padStart(2, '0')}</span><h4>{featured.name}</h4>{featured.promotion && <p className="promo-label">PROMO: {featured.promotion.quantity} POR {money(featured.promotion.price)}</p>}<p className="featured-price">{money(featured.price)}</p></div>{cart[featured.id] ? <div className="quantity-control"><button className="quantity-button" aria-label={`Quitar una unidad de ${featured.name}`} onClick={() => change(featured, -1)}><Minus size={16}/></button><span aria-label={`Cantidad: ${cart[featured.id]}`}>{cart[featured.id]}</span><button className="quantity-button" aria-label={`Agregar una unidad de ${featured.name}`} disabled={cart[featured.id] >= featured.stock} onClick={() => change(featured, 1)}><Plus size={16}/></button></div> : <button className="add-button" aria-label={`Agregar ${featured.name}`} onClick={() => change(featured, 1)}><Plus size={20}/></button>}</div>
      </section>}
      <div className="catalog-bar"><span><span className="bar-accent"/> TODOS LOS PRODUCTOS</span><span aria-live="polite">{loading ? 'CARGANDO...' : `${products.length} PRODUCTOS`}</span></div>
      {error && !open && <div role="alert" className="notice notice-error"><div><strong>NO PUDIMOS CARGAR EL CATÁLOGO</strong><p>{error}</p></div><button className="text-button" onClick={load}><RefreshCw size={15}/> REINTENTAR</button></div>}
      {loading ? <div className="empty-state" role="status"><LoaderCircle className="spin" size={28}/><strong>PREPARANDO EL CATÁLOGO</strong><span>Un momento, por favor.</span></div> : products.length === 0 && !error ? <div className="empty-state"><ShoppingBag size={28}/><strong>AÚN NO HAY PRODUCTOS</strong><span>El catálogo está vacío por ahora.</span></div> : !error && categories.map((category, groupIndex) => <section className="category-section" key={category.title} aria-labelledby={`category-${groupIndex}`}><div className="category-heading"><div><span className="category-index">{String(groupIndex + 1).padStart(2, '0')} / CATEGORÍA</span><h3 id={`category-${groupIndex}`}>{category.title}</h3></div><span className="category-count">{category.products.length} PRODUCTOS</span></div>{category.products.length === 0 ? <p className="category-empty">No hay productos en esta categoría por ahora.</p> : <div className="product-grid">{category.products.map((p, index) => <article key={p.id} className={`product-card ${!p.stock ? 'sold-out' : ''}`}>
        <ProductArt product={p} index={index}/>
        <div className="product-info"><h3>{p.name}</h3>{p.promotion && <p className="promo-label">PROMO: {p.promotion.quantity} POR {money(p.promotion.price)}</p>}<div className="product-bottom"><div><span className="price-label">PRECIO UNITARIO</span><p className="price">{money(p.price)}</p></div>{cart[p.id] ? <div className="quantity-control"><button className="quantity-button" aria-label={`Quitar una unidad de ${p.name}`} onClick={() => change(p, -1)}><Minus size={16}/></button><span aria-label={`Cantidad: ${cart[p.id]}`}>{cart[p.id]}</span><button className="quantity-button" aria-label={`Agregar una unidad de ${p.name}`} disabled={cart[p.id] >= p.stock} onClick={() => change(p, 1)}><Plus size={16}/></button></div> : <button className="add-button" disabled={!p.stock} aria-label={`Agregar ${p.name}`} onClick={() => change(p, 1)}><Plus size={20}/></button>}</div></div>
      </article>)}</div>}</section>)}
    </section>
    <footer className="site-footer"><div className="container footer-inner"><div className="footer-brand"><Image src="/brand/fenix-horizontal.png" alt="Escudería Fénix" width={5907} height={1773}/><span>TIENDA DEL TALLER</span></div><p>HECHO PARA EL DÍA A DÍA DEL EQUIPO <span>{'///'}</span></p></div></footer>

    {count > 0 && !open && !success && <div className="cart-dock"><button onClick={() => { setError(''); setOpen(true); }} className="cart-button"><span className="cart-icon"><ShoppingBag size={19}/><span>{count}</span></span><span className="cart-text"><small>TU SELECCIÓN</small><strong>VER MI PEDIDO</strong></span><span className="cart-total">{money(total)}</span><ArrowRight size={20}/></button></div>}
    {open && <div className="modal" onClick={() => !sending && setOpen(false)}><section className="sheet" role="dialog" aria-modal="true" aria-labelledby="cart-title" onClick={e => e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-heading"><div><p className="kicker section-kicker"><span className="slash"/> YA CASI TERMINAMOS</p><h2 id="cart-title">TU SELECCIÓN<span>.</span></h2></div><button onClick={() => setOpen(false)} disabled={sending} aria-label="Cerrar" className="close-button"><X size={20}/></button></div><form onSubmit={submit}><div className="order-items" aria-live="polite">{selected.length === 0 ? <p className="cart-empty">Tu carrito está vacío. Cierra esta ventana para elegir productos.</p> : selected.map(p => <div key={p.id} className="order-row"><div><strong>{p.name}</strong><span>{cart[p.id]} × {money(p.price)}{p.promotion && cart[p.id] >= p.promotion.quantity && <> · Promo: {p.promotion.quantity} por {money(p.promotion.price)}</>}</span><button type="button" className="remove-item" disabled={sending} onClick={() => change(p, -cart[p.id])} aria-label={`Eliminar ${p.name} del carrito`}>Eliminar</button></div><strong>{money(lineTotal(p, cart[p.id]))}</strong></div>)}</div><div className="order-total"><span>TOTAL</span><strong>{money(total)}</strong></div><label htmlFor="name">TU NOMBRE COMPLETO</label><input id="name" required minLength={3} maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="Escribe tu nombre y apellido" autoComplete="name" aria-describedby="name-hint"/><p id="name-hint" className="field-hint">Guardaremos tu nombre en este dispositivo después de tu compra. Puedes cambiarlo aquí cuando quieras.</p><fieldset className="payment-options"><legend>FORMA DE PAGO</legend><label className={`payment-option ${paymentMethod === 'cash' ? 'selected' : ''}`}><input type="radio" name="paymentMethod" value="cash" required checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')}/><span><strong>Pago en efectivo</strong><small>Dejaré el dinero en la caja fuerte.</small></span></label><label className={`payment-option ${paymentMethod === 'pending' ? 'selected' : ''}`}><input type="radio" name="paymentMethod" value="pending" required checked={paymentMethod === 'pending'} onChange={() => setPaymentMethod('pending')}/><span><strong>Dejar pendiente</strong><small>Se agregará a mi saldo pendiente.</small></span></label></fieldset>{error && <div role="alert" className="form-error">{error}{error.startsWith('Los precios') && <button type="button" className="refresh-prices" onClick={() => void load()}>Actualizar precios</button>}</div>}<button disabled={sending || !selected.length} className="button button-red submit-button">{sending ? <><LoaderCircle className="spin" size={18}/> REGISTRANDO COMPRA...</> : <>CONFIRMAR COMPRA <ArrowRight size={18}/></>}</button></form></section></div>}
    {success && <div className="modal"><section className="sheet success-sheet" role="dialog" aria-modal="true" aria-labelledby="success-title"><div className="success-icon"><Check size={30}/></div><p className="kicker section-kicker">COMPRA REGISTRADA</p><h2 id="success-title">¡LISTO PARA<br/>CONTINUAR<span>!</span></h2><p>{success.paymentMethod === 'cash' ? <>Tu compra de <strong>{money(success.total)}</strong> quedó registrada como pagada en efectivo. Deja el dinero en la caja fuerte.</> : <>Tu compra de <strong>{money(success.total)}</strong> quedó registrada en tu saldo pendiente.</>}</p><p className="reference">REFERENCIA: {success.saleId}</p><button onClick={() => { setSuccess(null); setPaymentMethod(''); }} className="button button-red submit-button">VOLVER A LA TIENDA <ArrowRight size={18}/></button></section></div>}
  </main>;
}

// Usa la instancia global "db" que se inicializa en index.html (Firebase)

const COLECCION_PRODUCTOS = "productos";
const NUMERO_WHATSAPP = "5491156465544"; // Cambiá por el número real de la ferretería

let productos = [];
let carrito = []; // { id: string, cantidad: number }

// ---------------------- UTILIDADES ----------------------

function formatearPrecio(numero) {
    return numero.toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0
    });
}

function obtenerProductoPorId(id) {
    return productos.find(p => p.id === id);
}

function obtenerImagenesProducto(producto) {
    const placeholder = "https://via.placeholder.com/300x200?text=Producto";
    let imagenes = [];

    if (producto.imagenes && producto.imagenes.length) {
        imagenes = producto.imagenes.filter(Boolean);
    } else if (producto.imagen) {
        imagenes = [producto.imagen];
    }

    if (imagenes.length === 0) imagenes = [placeholder];
    return imagenes;
}

// NUEVA FUNCIÓN: Asegura que la URL de la imagen sea absoluta
function makeAbsoluteUrl(url) {
    if (!url || url.startsWith('http://') || url.startsWith('https://')) {
        return url; // Ya es absoluta
    }
    // Si la URL es relativa, le anteponemos la URL base actual.
    // Usamos split('?')[0] para evitar anexar el path al parámetro ?producto=...
    const baseUrl = window.location.href.split('?')[0];
    const path = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
    return path + url;
}

// ---------------------- URL / DEEP-LINK ----------------------

function buildProductURL(id) {
    const url = new URL(window.location.href);
    url.searchParams.set("producto", id);
    return url.toString();
}

function getProductIdFromURL() {
    const url = new URL(window.location.href);
    return url.searchParams.get("producto");
}

function updateURLForProduct(id) {
    const url = buildProductURL(id);
    history.pushState({ producto: id }, "", url);
}

function clearProductFromURL() {
    const url = new URL(window.location.href);
    url.searchParams.delete("producto");
    history.pushState({}, "", url.toString());
}

// ---------------------- Open Graph Meta Tags (MODIFICADA) ----------------------

function actualizarMetaTagsProducto(producto) {
    // Valores por defecto
    const defaultTitle = "Thor Herramientas - Tu pasión, nuestra potencia";
    const defaultDescription = "Encontrá herramientas profesionales de calidad para talleres y construcción.";
    const defaultImage = "https://via.placeholder.com/600x400?text=Thor+Herramientas+Logo"; // Usar el mismo que en HTML
    
    let title, description, image, url;

    if (producto) {
        const imagenes = obtenerImagenesProducto(producto);
        const imagenPrincipal = imagenes[0];
        
        title = producto.nombre + ' | Thor Herramientas';
        // Descuento: Incluir precio y stock de forma destacada en la descripción para la vista previa
        description = `Precio: ${formatearPrecio(producto.precio)}. Stock: ${producto.stock}. ${producto.descripcion || ''}`; 
        image = makeAbsoluteUrl(imagenPrincipal); 
        url = buildProductURL(producto.id);
    } else {
        title = defaultTitle;
        description = defaultDescription;
        image = defaultImage;
        url = window.location.origin + window.location.pathname;
    }

    // Actualiza las meta tags
    document.title = title;
    
    // Función auxiliar para actualizar meta tags por propiedad
    const setMetaContent = (property, content) => {
        const tag = document.querySelector(`meta[property="${property}"]`);
        if (tag) tag.setAttribute('content', content);
    };

    setMetaContent('og:title', title);
    setMetaContent('og:description', description);
    setMetaContent('og:image', image);
    setMetaContent('og:url', url);
}
// ----------------------------------------------------------------------------------


// ---------------------- FIRESTORE ----------------------

async function cargarProductosDesdeFirestore() {
    const snapshot = await db.collection(COLECCION_PRODUCTOS).orderBy("nombre").get();
    productos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

// ---------------------- LISTA DE COMPRAS (LÓGICA) -------------------------

function guardarCarrito() {
    try {
        localStorage.setItem("carritoHerramientas", JSON.stringify(carrito));
    } catch (e) {
        console.warn("No se pudo guardar la lista de compras", e);
    }
}

function cargarCarrito() {
    try {
        const guardado = localStorage.getItem("carritoHerramientas");
        if (guardado) carrito = JSON.parse(guardado);
    } catch {
        carrito = [];
    }
}

function actualizarContadorCarrito() {
    const span = document.getElementById("cart-count");
    const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);
    if (span) span.textContent = totalItems;
}

function agregarAlCarrito(idProducto) {
    const producto = obtenerProductoPorId(idProducto);
    if (!producto) return false;

    if (producto.stock <= 0) {
        alert(`"${producto.nombre}" está agotado.`);
        return false;
    }

    const item = carrito.find(i => i.id === idProducto);
    const cantidadActual = item ? item.cantidad : 0;

    if (cantidadActual >= producto.stock) {
        alert(`No hay más stock disponible de "${producto.nombre}". Stock máximo: ${producto.stock} unidades.`);
        return false;
    }

    if (item) item.cantidad += 1;
    else carrito.push({ id: idProducto, cantidad: 1 });

    guardarCarrito();
    actualizarCarritoUI();
    return true;
}

function comprarAhora(idProducto) {
    const ok = agregarAlCarrito(idProducto);
    if (ok) abrirCarrito();
}

function cambiarCantidad(idProducto, delta) {
    const item = carrito.find(i => i.id === idProducto);
    if (!item) return;
    const producto = obtenerProductoPorId(item.id);
    if (!producto) return;

    if (delta > 0 && item.cantidad >= producto.stock) {
        alert(`No podés agregar más de ${producto.stock} unidades de "${producto.nombre}".`);
        return;
    }

    item.cantidad += delta;
    if (item.cantidad <= 0) {
        carrito = carrito.filter(i => i.id !== idProducto);
    }
    guardarCarrito();
    actualizarCarritoUI();
}

function eliminarDelCarrito(idProducto) {
    carrito = carrito.filter(i => i.id !== idProducto);
    guardarCarrito();
    actualizarCarritoUI();
}

function vaciarCarrito() {
    carrito = [];
    guardarCarrito();
    actualizarCarritoUI();
}

function calcularTotalCarrito() {
    return carrito.reduce((total, item) => {
        const producto = obtenerProductoPorId(item.id);
        if (!producto) return total;
        return total + producto.precio * item.cantidad;
    }, 0);
}

// ---------------------- UI LISTA DE COMPRAS ----------------------

function actualizarCarritoUI() {
    const contenedor = document.getElementById("carrito-items");
    const totalSpan = document.getElementById("carrito-total");
    const btnFinalizar = document.getElementById("btn-finalizar-compra");

    if (!contenedor || !totalSpan || !btnFinalizar) return;

    contenedor.innerHTML = "";

    if (carrito.length === 0) {
        contenedor.innerHTML = "<p>Tu lista de compras está vacía.</p>";
        totalSpan.textContent = formatearPrecio(0);
        btnFinalizar.classList.add("deshabilitado");
    } else {
        carrito.forEach(item => {
            const producto = obtenerProductoPorId(item.id);
            if (!producto) return;

            const div = document.createElement("div");
            div.className = "carrito-item";
            div.innerHTML = `
                <div class="carrito-item-info">
                    <h4>${producto.nombre}</h4>
                    <p class="carrito-precio-unitario">${formatearPrecio(producto.precio)} c/u</p>
                </div>
                <div class="carrito-item-controles">
                    <button class="btn-cantidad" data-accion="restar" data-id="${item.id}">-</button>
                    <span class="carrito-cantidad">${item.cantidad}</span>
                    <button class="btn-cantidad" data-accion="sumar" data-id="${item.id}">+</button>
                    <span class="carrito-subtotal">${formatearPrecio(producto.precio * item.cantidad)}</span>
                    <button class="btn-eliminar" data-id="${item.id}">🗑</button>
                </div>
            `;
            contenedor.appendChild(div);
        });

        totalSpan.textContent = formatearPrecio(calcularTotalCarrito());
        btnFinalizar.classList.remove("deshabilitado");
    }

    actualizarContadorCarrito();
}

function obtenerEnvioSeleccionado() {
    const select = document.getElementById("select-envio");
    if (!select) return "";
    return select.value;
}

// FUNCIÓN DE WHATSAPP SIMPLIFICADA (SIN PROMPTS)
function generarLinkWhatsAppCarrito() {
    if (carrito.length === 0) {
        alert("La lista de compras está vacía.");
        return null;
    }

    const envio = obtenerEnvioSeleccionado();
    
    // Eliminamos todos los prompts de datos del cliente
    let texto = "Hola Thor, quiero hacer este pedido:\n";
    carrito.forEach(item => {
        const producto = obtenerProductoPorId(item.id);
        if (!producto) return;
        const subtotal = producto.precio * item.cantidad;
        texto += `- ${item.cantidad} x ${producto.nombre} = ${formatearPrecio(subtotal)}\n`;
    });

    texto += `\nTotal: ${formatearPrecio(calcularTotalCarrito())}\n`;
    texto += `Opción de envío: ${envio || "No especificado"}\n\n`;
    texto += "Mis datos los confirmo por este chat."; // Mensaje para que el cliente ingrese sus datos

    const mensaje = encodeURIComponent(texto);
    // Lo lleva directamente a WhatsApp con el mensaje pre-cargado
    return `https://wa.me/${NUMERO_WHATSAPP}?text=${mensaje}`; 
}

// ---------------------- FILTROS Y LISTA ------------------

function obtenerMarcas() {
    const marcas = new Set();
    productos.forEach(p => {
        if (p.marca) marcas.add(p.marca);
    });
    return Array.from(marcas);
}

function cargarMarcasEnFiltro() {
    const select = document.getElementById("filtro-marca");
    if (!select) return;
    select.innerHTML = '<option value="todas">Todas las marcas</option>';
    obtenerMarcas().forEach(marca => {
        const op = document.createElement("option");
        op.value = marca;
        op.textContent = marca;
        select.appendChild(op);
    });
}

function renderProductos(lista) {
    const contenedor = document.getElementById("lista-productos");
    if (!contenedor) return;

    contenedor.innerHTML = "";

    if (lista.length === 0) {
        contenedor.innerHTML = "<p>No se encontraron productos.</p>";
        return;
    }

    lista.forEach(producto => {
        const agotado = producto.stock <= 0;
        // INICIO DEL CAMBIO: Usar la propiedad 'alimentacion'
        const textoAlimentacion = producto.alimentacion || "Tipo Desconocido"; 
        // FIN DEL CAMBIO
        const imagenes = obtenerImagenesProducto(producto);
        const imagenPrincipal = imagenes[0];

        let botonesHTML;
        if (agotado) {
            botonesHTML = `
                <div class="btn-agregar-contenedor">
                    <button class="btn-agregar btn-agotado" disabled>Agotado</button>
                </div>
            `;
        } else {
            botonesHTML = `
                <div class="btn-agregar-contenedor">
                    <div class="acciones-producto">
                        <button class="btn-agregar" data-id="${producto.id}">Agregar a mi lista</button> <button class="btn-comprar-ahora" data-id="${producto.id}">Quiero este artículo</button> </div>
                </div>
            `;
        }

        const tarjeta = document.createElement("article");
        tarjeta.className = "tarjeta-producto";
        tarjeta.dataset.id = producto.id;
        tarjeta.innerHTML = `
            <img src="${imagenPrincipal}" alt="${producto.nombre}">
            <h3>${producto.nombre}</h3>
            <p class="descripcion">${producto.descripcion || ""}</p>
            <p class="precio">${formatearPrecio(producto.precio)}</p>
            <p class="stock">${agotado ? "Producto agotado" : `Stock: ${producto.stock} unidades`}</p>
            <p class="stock">Marca: ${producto.marca || "-"} · ${textoAlimentacion}</p>
            <p class="envios">
                Opciones de envío:<br>
                ${(producto.opcionesEnvio || []).map(op => `<span>${op}</span>`).join("")}
            </p>
            ${botonesHTML}
        `;
        contenedor.appendChild(tarjeta);
    });
}

function aplicarFiltros() {
    const textoInput = document.getElementById("buscador");
    const filtroMarca = document.getElementById("filtro-marca");
    // INICIO DEL CAMBIO: Usar el ID correcto del filtro de alimentación
    const filtroAlimentacion = document.getElementById("filtro-alimentacion"); 
    // FIN DEL CAMBIO
    const ordenPrecio = document.getElementById("orden-precio");

    const texto = textoInput ? textoInput.value.toLowerCase().trim() : "";
    const marca = filtroMarca ? filtroMarca.value : "todas";
    
    // 1. Normalizamos el texto de búsqueda y dividimos en palabras clave (AND logic)
    const tNormalizado = texto.replace(/[^a-zA-Z0-9\s]/g, "").toLowerCase();
    const keywords = tNormalizado.split(/\s+/).filter(k => k.length > 0);

    // INICIO DEL CAMBIO: Usar el valor del filtro de alimentación
    const filtroAlimentacionValue = filtroAlimentacion ? filtroAlimentacion.value : "todos"; 
    // FIN DEL CAMBIO
    const orden = ordenPrecio ? ordenPrecio.value : "default";

    let filtrados = productos.filter(p => {
        const d = p; // p es el objeto producto
        
        // 2. Búsqueda de palabra clave: NOMBRE, MARCA y DESCRIPCIÓN (AND logic)
        const searchableText = (d.nombre || '') + ' ' + (d.descripcion || '') + ' ' + (d.marca || '');
        const searchableTextLower = searchableText.toLowerCase();

        // 3. Verifica que TODAS las palabras clave estén presentes en el texto buscable
        const keywordMatch = keywords.every(keyword => searchableTextLower.includes(keyword));
        
        // 4. Búsqueda por código de barras (normalizado) - si el texto es un posible código
        const codigosGuardados = d.codbarra ? d.codbarra.split(',') : [];
        const codbarraMatch = codigosGuardados.some(cod => {
            const codbarraGuardadoNormalizado = cod.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
            return codbarraGuardadoNormalizado.includes(tNormalizado);
        });

        const coincideTexto = keywordMatch || codbarraMatch;


        const coincideMarca = marca === "todas" ? true : p.marca === marca;

        // INICIO DEL CAMBIO: Nueva lógica de filtrado por la propiedad 'alimentacion'
        const coincideAlimentacion =
            filtroAlimentacionValue === "todos"
                ? true
                : (p.alimentacion === filtroAlimentacionValue); 
        // FIN DEL CAMBIO

        return coincideTexto && coincideMarca && coincideAlimentacion;
    });

    if (orden === "precio-asc") {
        filtrados = filtrados.slice().sort((a, b) => a.precio - b.precio);
    } else if (orden === "precio-desc") {
        filtrados = filtrados.slice().sort((a, b) => b.precio - a.precio);
    }

    renderProductos(filtrados);
}

// ---------------------- DETALLE PRODUCTO (deep-link + compartir + ampliar imagen) -----------------

function abrirDetalleProducto(idProducto) {
    const producto = obtenerProductoPorId(idProducto);
    if (!producto) return;
    
    // Al abrir el detalle, actualizamos las meta tags para la URL actual
    actualizarMetaTagsProducto(producto); 

    const panel = document.getElementById("detalle-panel");
    const backdrop = document.getElementById("detalle-backdrop");
    if (!panel || !backdrop) return;

    const agotado = producto.stock <= 0;
    // INICIO DEL CAMBIO: Usar la propiedad 'alimentacion'
    const textoAlimentacion = producto.alimentacion || "Tipo Desconocido"; 
    // FIN DEL CAMBIO
    const imagenes = obtenerImagenesProducto(producto);

    let botonesHTML;
    if (agotado) {
        botonesHTML = `<button class="btn-agregar btn-agotado" disabled>Agotado</button>`;
    } else {
        botonesHTML = `
            <div class="detalle-botones">
                <button class="btn-agregar" data-id="${producto.id}">Agregar a mi lista</button> <button class="btn-comprar-ahora" data-id="${producto.id}">Quiero este artículo</button> </div>
        `;
    }

    const hayCarrusel = imagenes.length > 1;

    panel.innerHTML = `
        <div class="detalle-panel-contenido">
            <div class="detalle-header">
                <h2>${producto.nombre}</h2>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button id="btn-compartir" title="Compartir" class="btn-secundario">Compartir</button>
                    <button id="btn-cerrar-detalle" class="btn-cerrar-detalle">✕</button>
                </div>
            </div>
            <div class="detalle-body">
                <div class="detalle-imagen-contenedor">
                    <img id="detalle-imagen" src="${imagenes[0]}" alt="${producto.nombre}" style="cursor: zoom-in;">
                    ${
                        hayCarrusel
                          ? `
                    <div class="detalle-imagen-controles">
                        <button id="detalle-prev" class="detalle-nav"><</button>
                        <span id="detalle-indicador" class="detalle-indicador">1 / ${imagenes.length}</span>
                        <button id="detalle-next" class="detalle-nav">></button>
                    </div>`
                          : ""
                    }
                </div>
                <div class="detalle-info">
                    <p class="detalle-precio">${formatearPrecio(producto.precio)}</p>
                    <p class="detalle-stock">${agotado ? "Producto agotado" : `Stock disponible: ${producto.stock} unidades`}</p>
                    <p class="detalle-descripcion">${producto.descripcion || ""}</p>
                    <p><strong>Marca:</strong> ${producto.marca || "-"} · Alimentación: ${textoAlimentacion}</p>
                    ${
                        (producto.codbarra) ? `<p><strong>Código de Barras:</strong> ${producto.codbarra}</p>` : "" // <-- NUEVO: Mostramos Código de Barras
                    }
                    ${
                        (producto.detalles && producto.detalles.length > 0)
                          ? `<ul class="detalle-lista">
                                ${producto.detalles.map(d => `<li>${d}</li>`).join("")}
                               </ul>`
                          : ""
                    }
                    <p class="detalle-envios-titulo">Opciones de envío:</p>
                    <ul class="detalle-envios">
                        ${(producto.opcionesEnvio || []).map(op => `<li>${op}</li>`).join("")}
                    </ul>
                    ${botonesHTML}
                </div>
            </div>
        </div>
    `;

    panel.classList.remove("oculto");
    backdrop.classList.remove("oculto");

    // Actualizamos la URL para compartir
    updateURLForProduct(producto.id);

    // Cerrar
    const btnCerrar = document.getElementById("btn-cerrar-detalle");
    if (btnCerrar) btnCerrar.addEventListener("click", () => {
        cerrarDetalleProducto();
        clearProductFromURL();
    });

    // Compartir / copiar enlace
    const btnCompartir = document.getElementById("btn-compartir");
    if (btnCompartir) {
        btnCompartir.addEventListener("click", async () => {
            const shareURL = buildProductURL(producto.id);
            const title = producto.nombre;
            const text = `Mirá este producto: ${producto.nombre}`;

            if (navigator.share) {
                try {
                    await navigator.share({ title, text, url: shareURL });
                } catch (e) {
                    // cancelado
                }
            } else if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(shareURL);
                    alert("Enlace copiado al portapapeles ✅");
                } catch {
                    prompt("Copiá el enlace:", shareURL);
                }
            } else {
                prompt("Copiá el enlace:", shareURL);
            }
        });
    }

    // Botones de acción
    const btnAgregar = panel.querySelector(".btn-agregar:not(.btn-agotado)");
    if (btnAgregar) {
        btnAgregar.addEventListener("click", e => agregarAlCarrito(e.target.dataset.id));
    }

    const btnComprarAhora = panel.querySelector(".btn-comprar-ahora");
    if (btnComprarAhora) {
        btnComprarAhora.addEventListener("click", e => comprarAhora(e.target.dataset.id));
    }

    // Carrusel
    if (hayCarrusel) {
        let indiceActual = 0;
        const imgEl = panel.querySelector("#detalle-imagen");
        const indicador = panel.querySelector("#detalle-indicador");
        const btnPrev = panel.querySelector("#detalle-prev");
        const btnNext = panel.querySelector("#detalle-next");

        function actualizarImagen() {
            imgEl.src = imagenes[indiceActual];
            if (indicador) indicador.textContent = `${indiceActual + 1} / ${imagenes.length}`;
        }

        btnPrev.addEventListener("click", () => {
            indiceActual = (indiceActual - 1 + imagenes.length) % imagenes.length;
            actualizarImagen();
        });

        btnNext.addEventListener("click", () => {
            indiceActual = (indiceActual + 1) % imagenes.length;
            actualizarImagen();
        });

        // Click en la imagen -> ampliar la imagen actual del carrusel
        imgEl.addEventListener("click", () => abrirImagenAmpliada(imagenes[indiceActual]));
    } else {
        const imgEl = panel.querySelector("#detalle-imagen");
        imgEl.addEventListener("click", () => abrirImagenAmpliada(imagenes[0]));
    }
}

function cerrarDetalleProducto() {
    const panel = document.getElementById("detalle-panel");
    const backdrop = document.getElementById("detalle-backdrop");
    if (panel) panel.classList.add("oculto");
    if (backdrop) backdrop.classList.add("oculto");
    
    // Al cerrar el detalle, revertimos las meta tags a los valores por defecto
    actualizarMetaTagsProducto(null); 
}

// ---------------------- IMAGEN AMPLIADA -----------------

function abrirImagenAmpliada(src) {
    const backdrop = document.getElementById("imagen-ampliada-backdrop");
    const img = document.getElementById("imagen-ampliada");
    const btnCerrar = document.getElementById("cerrar-imagen");

    if (!backdrop || !img || !btnCerrar) return;

    img.src = src;
    backdrop.classList.remove("oculto");

    // Cerramos al tocar el botón o el fondo
    btnCerrar.onclick = () => backdrop.classList.add("oculto");
    backdrop.onclick = (e) => {
        if (e.target === backdrop) {
            backdrop.classList.add("oculto");
        }
    };
}

// ---------------------- PANEL LISTA DE COMPRAS --------------------

function abrirCarrito() {
    const panel = document.getElementById("carrito-panel");
    const backdrop = document.getElementById("carrito-backdrop");
    if (panel) panel.classList.remove("oculto");
    if (backdrop) backdrop.classList.remove("oculto");
}

function cerrarCarrito() {
    const panel = document.getElementById("carrito-panel");
    const backdrop = document.getElementById("carrito-backdrop");
    if (panel) panel.classList.add("oculto");
    if (backdrop) backdrop.classList.add("oculto");
}

// ---------------------- INICIALIZACIÓN -------------------

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await cargarProductosDesdeFirestore();
    } catch (e) {
        console.error("Error cargando productos:", e);
        alert("No se pudieron cargar los productos.");
    }

    cargarCarrito();
    cargarMarcasEnFiltro();
    renderProductos(productos);
    actualizarCarritoUI();
    
    // Si la URL ya trae ?producto=ID, abrimos ese detalle
    const inicialId = getProductIdFromURL();
    if (inicialId) {
        const existe = obtenerProductoPorId(inicialId);
        if (existe) {
            // Actualizamos meta tags antes de abrir el modal (crucial para SEO/Sharing)
            actualizarMetaTagsProducto(existe); 
            abrirDetalleProducto(inicialId);
        } else {
             // Si el ID no existe, aseguramos las meta tags por defecto
            actualizarMetaTagsProducto(null);
        }
    } else {
        // Si no hay ID en URL, aseguramos las meta tags por defecto
        actualizarMetaTagsProducto(null);
    }


    // Filtros
    const buscador = document.getElementById("buscador");
    const filtroMarca = document.getElementById("filtro-marca");
    // INICIO DEL CAMBIO: Usar el ID correcto del filtro de alimentación
    const filtroAlimentacion = document.getElementById("filtro-alimentacion"); 
    // FIN DEL CAMBIO
    const ordenPrecio = document.getElementById("orden-precio");

    if (buscador) buscador.addEventListener("input", aplicarFiltros);
    if (filtroMarca) filtroMarca.addEventListener("change", aplicarFiltros);
    // INICIO DEL CAMBIO: Asignar listener al filtro de alimentación
    if (filtroAlimentacion) filtroAlimentacion.addEventListener("change", aplicarFiltros); 
    // FIN DEL CAMBIO
    if (ordenPrecio) ordenPrecio.addEventListener("change", aplicarFiltros);

    // Menú de filtros desplegable
    const btnToggleFiltros = document.getElementById("btn-toggle-filtros");
    const filtrosContenido = document.getElementById("filtros-contenido");
    if (btnToggleFiltros && filtrosContenido) {
        btnToggleFiltros.addEventListener("click", () => {
            filtrosContenido.classList.toggle("oculto");
        });
    }

    // Clicks en lista de productos
    const listaProductos = document.getElementById("lista-productos");
    if (listaProductos) {
        listaProductos.addEventListener("click", (e) => {
            if (e.target.classList.contains("btn-comprar-ahora")) {
                const id = e.target.dataset.id;
                comprarAhora(id);
                e.stopPropagation();
                return;
            }
            if (e.target.classList.contains("btn-agregar") && !e.target.classList.contains("btn-agotado")) {
                const id = e.target.dataset.id;
                agregarAlCarrito(id);
                e.stopPropagation();
                return;
            }
            const tarjeta = e.target.closest(".tarjeta-producto");
            if (tarjeta) {
                const id = tarjeta.dataset.id;
                abrirDetalleProducto(id);
            }
        });
    }

    // Carrito
    const btnVerCarrito = document.getElementById("btn-ver-carrito");
    const btnCerrarCarrito = document.getElementById("btn-cerrar-carrito");
    const carritoBackdrop = document.getElementById("carrito-backdrop");

    if (btnVerCarrito) btnVerCarrito.addEventListener("click", abrirCarrito);
    if (btnCerrarCarrito) btnCerrarCarrito.addEventListener("click", cerrarCarrito);
    if (carritoBackdrop) carritoBackdrop.addEventListener("click", cerrarCarrito);

    const btnVaciarCarrito = document.getElementById("btn-vaciar-carrito");
    if (btnVaciarCarrito) {
        btnVaciarCarrito.addEventListener("click", () => {
            if (carrito.length === 0) return;
            vaciarCarrito();
        });
    }

    const carritoItems = document.getElementById("carrito-items");
    if (carritoItems) {
        carritoItems.addEventListener("click", (e) => {
            const id = e.target.dataset.id;
            if (!id) return;

            if (e.target.classList.contains("btn-cantidad")) {
                const accion = e.target.dataset.accion;
                if (accion === "sumar") cambiarCantidad(id, +1);
                if (accion === "restar") cambiarCantidad(id, -1);
            }
            if (e.target.classList.contains("btn-eliminar")) {
                eliminarDelCarrito(id);
            }
        });
    }

    const btnFinalizarCompra = document.getElementById("btn-finalizar-compra");
    if (btnFinalizarCompra) {
        btnFinalizarCompra.addEventListener("click", (e) => {
            e.preventDefault();
            const link = generarLinkWhatsAppCarrito();
            if (link) window.location.href = link;
        });
    }

    const detalleBackdrop = document.getElementById("detalle-backdrop");
    if (detalleBackdrop) detalleBackdrop.addEventListener("click", () => {
        cerrarDetalleProducto();
        clearProductFromURL();
    });

    // Navegación del navegador (Back/Forward)
    window.addEventListener("popstate", () => {
        const pid = getProductIdFromURL();
        if (pid) {
            const p = obtenerProductoPorId(pid);
            if (p) {
                actualizarMetaTagsProducto(p);
                abrirDetalleProducto(pid);
            }
        } else {
            cerrarDetalleProducto();
            actualizarMetaTagsProducto(null); // Asegura que se reviertan los meta tags
        }
    });
});
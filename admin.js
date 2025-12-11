// Colecciones de Firestore
const productosRef = db.collection("productos");
const COLECCION_VENTAS = "ventas"; 

let productos = []; 		// [{id, data}]
let filtroTexto = ""; 	  // texto del buscador
let ventaActual = [];   // [{id: string, cantidad: number, precio: number, nombre: string}] 
let porcentajeDescuento = 0; // Almacena el porcentaje (0-100)
let myChartGanancia = null; // Para guardar la instancia del gráfico
let myChartProductos = null;
let myChartTransacciones = null;

function formatearPrecio(numero) {
  // 1. Redondeamos el número a un entero.
  const numRedondeado = Math.round(Number(numero) || 0);
  
  // 2. Formateamos y reemplazamos TODOS los espacios por un espacio duro (\u00A0)
  // para evitar que el precio se corte en el PDF y forzamos ancho en generarPDFStock.
  return numRedondeado.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0
  }).replace(/\s/g, '\u00A0'); 
}

function limpiarFormulario() {
  document.getElementById("prod-id").value = "";
  document.getElementById("prod-nombre").value = "";
  document.getElementById("prod-marca").value = "";
  document.getElementById("prod-precio").value = "";
  document.getElementById("prod-stock").value = "";
  document.getElementById("prod-codbarra").value = ""; // Limpiamos Código de Barras
  document.getElementById("prod-alimentacion").value = "Otro"; // Valor por defecto
  document.getElementById("prod-imagen").value = "";
  document.getElementById("prod-descripcion").value = "";
  document.getElementById("prod-envios").value = "";
  document.getElementById("prod-detalles").value = "";

  const previewBox = document.getElementById("preview-contenedor");
  const previewImg = document.getElementById("preview-imagen");
  const estado = document.getElementById("estado-subida");
  if (previewBox) previewBox.classList.add("oculto");
  if (previewImg) previewImg.src = "";
  if (estado) estado.textContent = "";
}

function cargarProductoEnFormulario(id, prod) {
  document.getElementById("prod-id").value = id;
  document.getElementById("prod-nombre").value = prod.nombre || "";
  document.getElementById("prod-marca").value = prod.marca || "";
  document.getElementById("prod-precio").value = prod.precio || 0;
  document.getElementById("prod-stock").value = prod.stock || 0;
  document.getElementById("prod-codbarra").value = prod.codbarra || ""; // Cargamos Código de Barras
  document.getElementById("prod-alimentacion").value = prod.alimentacion || "Otro";
  document.getElementById("prod-descripcion").value = prod.descripcion || "";
  document.getElementById("prod-envios").value = (prod.opcionesEnvio || []).join(", ");
  document.getElementById("prod-detalles").value = (prod.detalles || []).join("\n");

  const imagenes = (prod.imagenes && prod.imagenes.length)
    ? prod.imagenes
    : (prod.imagen ? [prod.imagen] : []);
  document.getElementById("prod-imagen").value = imagenes.join(", ");

  const previewBox = document.getElementById("preview-contenedor");
  const previewImg = document.getElementById("preview-imagen");
  if (previewBox && previewImg) {
    if (imagenes.length > 0) {
      previewImg.src = imagenes[0];
      previewBox.classList.remove("oculto");
    } else {
      previewBox.classList.add("oculto");
      previewImg.src = "";
    }
  }
}

function productosFiltrados() {
  if (!filtroTexto) return productos;
  const t = filtroTexto.toLowerCase().trim();
  
  // 1. Normalizamos el texto de búsqueda y dividimos en palabras clave (AND logic)
  const tNormalizado = filtroTexto.replace(/[^a-zA-Z0-9\s]/g, "").toLowerCase();
  const keywords = tNormalizado.split(/\s+/).filter(k => k.length > 0);

  return productos.filter(p => {
    const d = p.data;
    
    // 2. Búsqueda de palabra clave: NOMBRE, MARCA y DESCRIPCIÓN (AND logic)
    const searchableText = (d.nombre || '') + ' ' + (d.descripcion || '') + ' ' + (d.marca || '');
    const searchableTextLower = searchableText.toLowerCase();

    // 3. Verifica que TODAS las palabras clave estén presentes en el texto buscable
    const keywordMatch = keywords.every(keyword => searchableTextLower.includes(keyword));

    // 4. Búsqueda por código de barras (soporta múltiples códigos)
    const codigosGuardados = d.codbarra ? d.codbarra.split(',') : [];
    
    const codbarraMatch = codigosGuardados.some(cod => {
        const codbarraGuardadoNormalizado = cod.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        return codbarraGuardadoNormalizado.includes(tNormalizado);
    });
    
    return keywordMatch || codbarraMatch; // Coincide si alguna de las dos búsquedas coincide
  });
}

/* ====== ESTADÍSTICAS ====== */
function calcularEstadisticas(lista) {
  const total = lista.length;
  let activos = 0;
  let agotados = 0;
  let valorTotal = 0;

  for (const p of lista) {
    const stock = Number(p.data.stock) || 0;
    const precio = Number(p.data.precio) || 0;
    if (stock > 0) activos++; else agotados++;
    valorTotal += stock * precio;
  }
  return { total, activos, agotados, valorTotal };
}

function renderEstadisticas() {
  const { total, activos, agotados, valorTotal } = calcularEstadisticas(productos);
  const elTotal = document.getElementById("stat-total");
  const elAct = document.getElementById("stat-activos");
  const elAgo = document.getElementById("stat-agotados");
  const elVal = document.getElementById("stat-valor");
  if (elTotal) elTotal.textContent = total;
  if (elAct) elAct.textContent = activos;
  if (elAgo) elAgo.textContent = agotados;
  if (elVal) elVal.textContent = formatearPrecio(valorTotal);
}
/* ========================== */

function renderTablaProductos() {
  const tbody = document.getElementById("tabla-productos-body");
  tbody.innerHTML = "";

  const lista = productosFiltrados();

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">No se encontraron productos.</td></tr>`;
    return;
  }

  lista.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.data.nombre || "-"}</td>
      <td>${p.data.marca || "-"}</td>
      <td>${formatearPrecio(p.data.precio || 0)}</td>
      <td style="text-align: center;">
        <div class="stock-controls" data-id="${p.id}" style="display:flex; align-items:center; justify-content:center; gap:4px;">
            <button class="btn-stock-quick" data-delta="-1" data-id="${p.id}" style="
                padding: 1px 6px; border: 1px solid #ccc; background: #f0f0f0; cursor: pointer; border-radius: 4px; font-weight: bold;
            ">-</button>
            <input type="number" id="stock-input-${p.id}" value="${p.data.stock ?? 0}" min="0" data-id="${p.id}"
                style="width: 45px; text-align: center; border: 1px solid #ccc; border-radius: 4px; padding: 1px;" 
                class="stock-input-edit"
            >
            <button class="btn-stock-quick" data-delta="+1" data-id="${p.id}" style="
                padding: 1px 5px; border: 1px solid #ccc; background: #f0f0f0; cursor: pointer; border-radius: 4px; font-weight: bold;
            ">+</button>
        </div>
      </td>
      <td>${p.data.alimentacion || "-"}</td>
      <td>
        <div class="admin-table-actions">
          <button class="btn-principal btn-pequeño" data-accion="editar" data-id="${p.id}">Editar</button>
          <button class="btn-secundario btn-pequeño" data-accion="eliminar" data-id="${p.id}">Eliminar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function cargarProductosDesdeFirestore() {
  const snapshot = await productosRef.orderBy("nombre").get();
  productos = snapshot.docs.map(doc => ({
    id: doc.id,
    data: doc.data()
  }));
  renderEstadisticas(); 	
  renderTablaProductos(); 	
}

// ---------------------- FUNCIONALIDAD DE ACTUALIZACIÓN DE STOCK ----------------------

// NUEVA FUNCIÓN: Actualiza el stock cuando el usuario presiona Enter o cambia el campo
async function actualizarStockRapidoPorInput(idProducto, nuevoValor) {
    const prodEntry = productos.find(p => p.id === idProducto);
    if (!prodEntry) return;

    let nuevoStock = Number(nuevoValor);
    if (isNaN(nuevoStock) || nuevoStock < 0) {
        alert("Valor de stock inválido. Debe ser un número positivo.");
        // Restablecer el valor en la UI
        const inputEl = document.getElementById(`stock-input-${idProducto}`);
        if(inputEl) inputEl.value = prodEntry.data.stock ?? 0;
        return;
    }
    
    // Aseguramos que sea un entero (opcional, pero stock suele ser entero)
    nuevoStock = Math.round(nuevoStock);

    try {
        // 1. Actualizar en Firestore
        await productosRef.doc(idProducto).update({ stock: nuevoStock });
        
        // 2. Actualizar la variable local 'productos'
        prodEntry.data.stock = nuevoStock; 
        
        // 3. Actualizar la UI (estadísticas)
        renderEstadisticas();

        console.log(`Stock de ${prodEntry.data.nombre} actualizado a ${nuevoStock} por teclado.`);
        
    } catch (err) {
        console.error("Error actualizando stock por input:", err);
        alert("Hubo un error al actualizar el stock.");
    }
}

// FUNCION EXISTENTE: Actualiza el stock por +/- botones
async function actualizarStockRapido(idProducto, delta) {
    const prodEntry = productos.find(p => p.id === idProducto);
    if (!prodEntry) return;

    const stockActual = Number(prodEntry.data.stock) || 0;
    const nuevoStock = stockActual + delta;

    if (nuevoStock < 0) {
        alert(`El stock no puede ser negativo para ${prodEntry.data.nombre}. Stock actual: ${stockActual}`);
        return;
    }

    try {
        // 1. Actualizar en Firestore
        await productosRef.doc(idProducto).update({ stock: nuevoStock });
        
        // 2. Actualizar la variable local 'productos'
        prodEntry.data.stock = nuevoStock; 
        
        // 3. Actualizar la UI localmente (input y estadísticas)
        const inputEl = document.getElementById(`stock-input-${idProducto}`);
        if (inputEl) inputEl.value = nuevoStock; // Actualizamos el input
        renderEstadisticas();
        
    } catch (err) {
        console.error("Error actualizando stock:", err);
        alert("Hubo un error al actualizar el stock.");
    }
}
// ---------------------------------------------------------------------------


// ---------------------- FUNCIONALIDAD VENTA RÁPIDA (POS) - FUNCIONES GLOBALES ----------------------

function vaciarVenta() {
    ventaActual = [];
    porcentajeDescuento = 0; // Reinicia el porcentaje de descuento
    const inputDescuento = document.getElementById('venta-input-descuento');
    if (inputDescuento) inputDescuento.value = ''; // Limpia el input de descuento
    renderVentaPanel();
    renderVentaSuggestions([]); // Oculta sugerencias al vaciar
}

function abrirVenta() {
    const backdrop = document.getElementById('venta-backdrop');
    if (backdrop) {
        backdrop.style.display = 'flex'; 
        backdrop.classList.remove('oculto');
    }
    vaciarVenta(); 
    document.getElementById('venta-input-codbarra').focus();
}

function cerrarVenta() {
    const backdrop = document.getElementById('venta-backdrop');
    if (backdrop) {
        backdrop.style.display = 'none'; 
        backdrop.classList.add('oculto'); 
    }
    vaciarVenta();
    const buscadorAdmin = document.getElementById('buscador-admin');
    if (buscadorAdmin) buscadorAdmin.focus();
}

// FUNCIÓN MODIFICADA: Aplica el descuento en porcentaje
function aplicarDescuento() {
    const inputDescuento = document.getElementById('venta-input-descuento');
    if (!inputDescuento) return;

    let porcentaje = Number(inputDescuento.value) || 0;
    
    // Validaciones
    if (porcentaje < 0 || porcentaje > 100) {
        alert("El descuento debe ser un porcentaje entre 0 y 100.");
        porcentaje = Math.min(100, Math.max(0, porcentaje)); // Limita entre 0 y 100
        inputDescuento.value = porcentaje;
    }

    porcentajeDescuento = porcentaje;
    renderVentaPanel();
}

// FUNCIÓN MODIFICADA: Quita el descuento
function quitarDescuento() {
    const inputDescuento = document.getElementById('venta-input-descuento');
    if (inputDescuento) inputDescuento.value = '';
    porcentajeDescuento = 0; // Reinicia el porcentaje
    renderVentaPanel();
}


function renderVentaPanel() {
    const listaDiv = document.getElementById('venta-items-list');
    const totalSinDtoSpan = document.getElementById('venta-total-sin-dto-display');
    const descuentoAplicadoSpan = document.getElementById('venta-descuento-aplicado-display');
    const totalFinalSpan = document.getElementById('venta-total-final-display');
    const btnConfirmar = document.getElementById('btn-confirmar-venta');
    
    const totalSinDescuento = ventaActual.reduce((total, item) => total + (item.precio * item.cantidad), 0);
    
    // CÁLCULO CLAVE PARA PORCENTAJE
    const montoDescuento = totalSinDescuento * (porcentajeDescuento / 100);
    const totalFinal = Math.max(0, totalSinDescuento - montoDescuento); 

    listaDiv.innerHTML = '';

    if (ventaActual.length === 0) {
        listaDiv.innerHTML = '<p style="color:#777;">No hay productos en la venta.</p>';
        btnConfirmar.disabled = true;
    } else {
        ventaActual.forEach(item => {
            const subtotal = item.precio * item.cantidad;
            
            const p = document.createElement('p');
            p.innerHTML = `
                <span style="font-weight:600;">${item.cantidad}x</span> 
                ${item.nombre} 
                <span style="float:right;">${formatearPrecio(subtotal).replace(/\u00A0/g, ' ')}</span>
            `;
            listaDiv.appendChild(p);
        });
        btnConfirmar.disabled = false;
    }

    // Actualiza los displays de totales y descuento
    totalSinDtoSpan.textContent = formatearPrecio(totalSinDescuento).replace(/\u00A0/g, ' ');
    descuentoAplicadoSpan.textContent = formatearPrecio(montoDescuento).replace(/\u00A0/g, ' ');
    totalFinalSpan.textContent = formatearPrecio(totalFinal).replace(/\u00A0/g, ' ');
}

/**
 * Función central de búsqueda para el POS:
 * 1. Intenta encontrar por código de barras exacto (escáner).
 * 2. Si falla, intenta encontrar por palabra clave en Nombre/Marca.
 * @param {string} input Texto ingresado en el campo.
 */
function buscarProductoParaVenta(input) {
    if (!input) return [];
    
    const inputLower = input.toLowerCase().trim();
    const inputNormalizado = input.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

    // 1. Búsqueda por CÓDIGO DE BARRAS (Coincidencia exacta)
    const matchByBarcode = productos.find(p => {
        // Debemos acceder a p.data.codbarra ya que p es {id, data}
        const codigosGuardados = p.data.codbarra ? p.data.codbarra.split(',') : [];
        return codigosGuardados.some(cod => {
            const codbarraGuardadoNormalizado = cod.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
            return codbarraGuardadoNormalizado === inputNormalizado; 
        });
    });
    if (matchByBarcode) return [matchByBarcode]; // Si hay coincidencia exacta de código, devuelve SOLO ESE.

    // 2. Búsqueda por PALABRA CLAVE (Nombre/Marca/Descripción)
    const keywords = inputNormalizado.split(/\s+/).filter(k => k.length > 0);
    
    const matchesByKeyword = productos.filter(p => {
        const d = p.data;
        const searchableText = (d.nombre || '') + ' ' + (d.descripcion || '') + ' ' + (d.marca || '');
        const searchableTextLower = searchableText.toLowerCase();

        // Verifica que TODAS las palabras clave estén presentes
        const keywordMatch = keywords.every(keyword => searchableTextLower.includes(keyword));
        
        return keywordMatch;
    });

    return matchesByKeyword; // Devuelve los matches por nombre (puede ser 0 o muchos)
}


/**
 * Agrega un producto a la venta, asumiendo que se encontró por nombre o código.
 * @param {object} productoEnStock Objeto de producto {id, data}.
 */
function agregarProductoEncontrado(productoEnStock) {
    const itemEnVenta = ventaActual.find(item => item.id === productoEnStock.id);
    const stockDisponible = Number(productoEnStock.data.stock) || 0;
    const cantidadActualVenta = itemEnVenta ? itemEnVenta.cantidad : 0;

    if (stockDisponible <= cantidadActualVenta) {
        alert(`Stock agotado o insuficiente de "${productoEnStock.data.nombre}". Stock disponible: ${stockDisponible}.`);
        return;
    }

    if (itemEnVenta) {
        itemEnVenta.cantidad += 1;
    } else {
        ventaActual.push({
            id: productoEnStock.id,
            nombre: productoEnStock.data.nombre,
            precio: Number(productoEnStock.data.precio) || 0,
            cantidad: 1
        });
    }

    renderVentaPanel();
}

// Función que maneja la entrada de texto del POS (se llama desde el listener 'input')
function liveSearchVenta() {
    const inputEl = document.getElementById('venta-input-codbarra');
    const input = inputEl.value;

    if (input.length < 2) {
        renderVentaSuggestions([]);
        return;
    }

    const resultados = buscarProductoParaVenta(input);
    
    // Si la búsqueda devuelve UN resultado por coincidencia exacta de código, agrégalo directamente.
    // Esto maneja el escáner rápido o si el usuario escribe un código exacto.
    if (resultados.length === 1 && buscarProductoParaVenta(input).length === 1 && (
        (resultados[0].data.codbarra && resultados[0].data.codbarra.includes(input)) 
    )) {
        
        // Es una coincidencia exacta de código, agregar y limpiar.
         agregarProductoEncontrado(resultados[0]);
         inputEl.value = '';
         renderVentaSuggestions([]);
         return;
    }
    
    // Si hay más de un resultado o la búsqueda es parcial por nombre, muestra la lista
    renderVentaSuggestions(resultados.slice(0, 8)); // Muestra hasta 8 sugerencias
}

// Renderiza la lista de sugerencias clicables
function renderVentaSuggestions(sugerencias) {
    const listaSugerencias = document.getElementById('venta-sugerencias-list');
    const inputEl = document.getElementById('venta-input-codbarra');
    
    // Si el campo de búsqueda está vacío, no mostramos nada.
    if (!inputEl.value.trim() || sugerencias.length === 0) {
        listaSugerencias.classList.add('oculto');
        listaSugerencias.innerHTML = '';
        return;
    }

    listaSugerencias.innerHTML = '';

    sugerencias.forEach(p => {
        const div = document.createElement('div');
        div.className = 'sugerencia-item';
        div.dataset.id = p.id; // Almacenamos el ID para el click
        div.innerHTML = `
            <span>${p.data.nombre} (${p.data.marca || '-'})</span>
            <span style="font-weight: 600;">${formatearPrecio(p.data.precio)}</span>
        `;
        div.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const productoSeleccionado = productos.find(prod => prod.id === id);
            
            if (productoSeleccionado) {
                agregarProductoEncontrado(productoSeleccionado);
                const inputEl = document.getElementById('venta-input-codbarra');
                inputEl.value = ''; // Limpia el campo después de la selección
                inputEl.focus(); // Vuelve el foco para la próxima búsqueda/escaneo
            }
            renderVentaSuggestions([]); // Oculta la lista después de seleccionar
        });
        listaSugerencias.appendChild(div);
    });

    listaSugerencias.classList.remove('oculto');
}


async function confirmarVenta() {
    if (ventaActual.length === 0) return;

    try {
        const updates = await db.runTransaction(async (transaction) => {
            const updatesList = [];
            
            for (const item of ventaActual) {
                const docRef = productosRef.doc(item.id);
                const doc = await transaction.get(docRef);

                if (!doc.exists) {
                    throw new Error(`Producto ${item.nombre} no existe en la base de datos.`);
                }
                
                const data = doc.data();
                const stockActual = Number(data.stock) || 0;
                const cantidadVendida = item.cantidad;
                const nuevoStock = stockActual - cantidadVendida;

                if (nuevoStock < 0) {
                    throw new Error(`Stock insuficiente para "${item.nombre}". Stock: ${stockActual}, Venta: ${cantidadVendida}.`);
                }

                transaction.update(docRef, { stock: nuevoStock });

                updatesList.push({ id: item.id, nuevoStock: nuevoStock });
            }

            return updatesList;
        });

        updates.forEach(update => {
            const prodEntry = productos.find(p => p.id === update.id);
            if (prodEntry) prodEntry.data.stock = update.nuevoStock;
        });

        const totalSinDto = ventaActual.reduce((t, i) => t + i.precio * i.cantidad, 0);
        const montoDescuento = totalSinDto * (porcentajeDescuento / 100);
        const totalFinalVenta = totalSinDto - montoDescuento;

        // --- LÓGICA PARA GUARDAR LA VENTA ---
        const ventaData = {
            fecha: firebase.firestore.FieldValue.serverTimestamp(), // Firestore timestamp
            fechaString: new Date().toISOString().split('T')[0], // YYYY-MM-DD for easier grouping/querying
            totalSinDescuento: totalSinDto,
            montoDescuento: montoDescuento,
            porcentajeDescuento: porcentajeDescuento,
            totalFinal: totalFinalVenta,
            items: ventaActual.map(item => ({
                id: item.id,
                nombre: item.nombre,
                precioUnitario: item.precio,
                cantidad: item.cantidad
            }))
        };
        
        await db.collection(COLECCION_VENTAS).add(ventaData);
        // --- FIN LÓGICA PARA GUARDAR LA VENTA ---


        alert(`Venta por ${formatearPrecio(totalFinalVenta).replace(/\u00A0/g, ' ')} (Dto: ${porcentajeDescuento}%) confirmada y stock actualizado!`);
        
        vaciarVenta();
        renderTablaProductos();
        renderEstadisticas();
        cerrarVenta(); 

    } catch (error) {
        console.error("Error en la transacción de venta:", error);
        alert(`Error al confirmar la venta: ${error.message}`);
    }
}
// ---------------------------------------------------------------------------


// ---------------------- FUNCIONALIDAD HISTORIAL DE VENTAS Y GRÁFICOS ----------------------

function procesarDatosParaGraficos(ventas) {
    // Calcula las fechas para los últimos 7 días (0 = hoy, 6 = hace 6 días)
    const fechas = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        fechas.push(d.toISOString().split('T')[0]);
    }
    
    const datosDiarios = {}; // Agrupados por fechaString (YYYY-MM-DD)
    const datosProductos = {}; // { nombreProducto: cantidadTotalVendida }

    // Inicializar datos para los 7 días
    fechas.forEach(fecha => {
        datosDiarios[fecha] = { ganancia: 0, transacciones: 0, ventas: [] };
    });

    ventas.forEach(venta => {
        const fecha = venta.fechaString;
        
        // 1. Datos Diarios (Ganancia y Transacciones)
        if (datosDiarios[fecha]) {
            datosDiarios[fecha].ganancia += venta.totalFinal || 0;
            datosDiarios[fecha].transacciones += 1;
            datosDiarios[fecha].ventas.push(venta); // Almacenar la venta completa para el detalle
        } else {
             // Esto puede ocurrir si hay ventas guardadas que caen justo en el límite de los 7 días.
            return;
        }

        // 2. Datos Productos
        venta.items.forEach(item => {
            const nombre = item.nombre;
            const cantidad = item.cantidad || 0;
            datosProductos[nombre] = (datosProductos[nombre] || 0) + cantidad;
        });
    });

    // --- Preparación de datos para Chart.js ---
    
    // 1. Etiquetas de fecha (ej: Lun 18)
    const etiquetasFecha = fechas.map(f => new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }));

    // 2. Gráfico de Ganancia Diaria (Ganancia en Pesos)
    const valoresGanancia = fechas.map(f => datosDiarios[f].ganancia);
    
    // 3. Gráfico de Transacciones Diarias (Número de Transacciones)
    const valoresTransacciones = fechas.map(f => datosDiarios[f].transacciones);
    
    // 4. Gráfico de Productos Vendidos (Top 5)
    const topProductos = Object.entries(datosProductos)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    const etiquetasProductos = topProductos.map(([nombre]) => nombre);
    const valoresProductos = topProductos.map(([, cantidad]) => cantidad);
    
    return {
        // Devolvemos el objeto completo para renderizar el detalle por día
        ventasPorDia: datosDiarios, 
        // Datos para los 3 gráficos
        ganancia: { labels: etiquetasFecha, data: valoresGanancia },
        productos: { labels: etiquetasProductos, data: valoresProductos },
        transacciones: { labels: etiquetasFecha, data: valoresTransacciones }
    };
}

function dibujarGraficos(datos) {
    // Destruye instancias antiguas si existen
    if (myChartGanancia) myChartGanancia.destroy();
    if (myChartProductos) myChartProductos.destroy();
    if (myChartTransacciones) myChartTransacciones.destroy();

    // 1. GRÁFICO DE GANANCIA DIARIA (Ganancia en Pesos)
    const ctxGanancia = document.getElementById('grafico-ganancia-diaria').getContext('2d');
    myChartGanancia = new Chart(ctxGanancia, {
        type: 'bar',
        data: {
            labels: datos.ganancia.labels,
            datasets: [{
                label: 'Ganancia Final (ARS)',
                data: datos.ganancia.data,
                backgroundColor: 'rgba(0, 166, 80, 0.7)', // Verde
                borderColor: 'rgba(0, 166, 80, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Monto (ARS)' } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (context) => `ARS ${formatearPrecio(context.parsed.y).replace(/\u00A0/g, ' ').replace('$', '')}` } }
            }
        }
    });

    // 2. GRÁFICO DE PRODUCTOS VENDIDOS (Top 5)
    const ctxProductos = document.getElementById('grafico-productos-vendidos').getContext('2d');
    myChartProductos = new Chart(ctxProductos, {
        type: 'doughnut',
        data: {
            labels: datos.productos.labels,
            datasets: [{
                label: 'Cantidad Vendida',
                data: datos.productos.data,
                backgroundColor: ['#1976d2', '#ffd600', '#c62828', '#2e7d32', '#9c27b0'], // Colores corporativos y otros
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: false },
                legend: { position: 'bottom' }
            }
        }
    });

    // 3. GRÁFICO DE TRANSACCIONES DIARIAS (Transacciones)
    const ctxTransacciones = document.getElementById('grafico-transacciones-diarias').getContext('2d');
    myChartTransacciones = new Chart(ctxTransacciones, {
        type: 'line',
        data: {
            labels: datos.transacciones.labels,
            datasets: [{
                label: 'Transacciones',
                data: datos.transacciones.data,
                backgroundColor: 'rgba(25, 118, 210, 0.2)', // Azul claro
                borderColor: 'rgba(25, 118, 210, 1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Número de Ventas' }, ticks: { precision: 0 } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}


async function cargarHistorialVentas() {
    const listaCont = document.getElementById('historial-ventas-list');
    const loader = document.getElementById('historial-loader');
    
    listaCont.innerHTML = '';
    loader.style.display = 'block';

    try {
        // --- CÁLCULO DE RANGO DE FECHAS (ÚLTIMOS 7 DÍAS) ---
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); 
        
        const haceSieteDias = new Date(hoy);
        haceSieteDias.setDate(hoy.getDate() - 7); // Inicio hace 7 días (00:00:00)
        
        const timestampLimite = firebase.firestore.Timestamp.fromDate(haceSieteDias);
        // --- FIN CÁLCULO DE RANGO DE FECHAS ---

        // 1. Consultar ventas: solo las que ocurrieron a partir del inicio de "hace 7 días"
        // NOTA: Se ha quitado el orderBy('fecha', 'desc') para evitar el error de índice
        // y se ordenarán los datos en el cliente.
        const snapshot = await db.collection(COLECCION_VENTAS)
            .where('fecha', '>=', timestampLimite)
            .get(); 
        
        const ventas = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Ordenamos en el cliente para asegurar el orden cronológico
        ventas.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));

        // 2. Procesar datos para la lista y los gráficos
        const datosProcesados = procesarDatosParaGraficos(ventas);

        // 3. Dibujar los gráficos
        dibujarGraficos(datosProcesados);
        
        // 4. Renderizar el detalle por día (usando las ventas agrupadas del procesamiento)
        renderHistorialVentas(datosProcesados.ventasPorDia);

    } catch (e) {
        console.error("Error cargando historial de ventas:", e);
        listaCont.innerHTML = '<p style="color:var(--rojo);">Error al cargar el historial de ventas. (Ver consola F12 para detalles)</p>';
    } finally {
        loader.style.display = 'none';
    }
}

function renderHistorialVentas(ventasPorDia) {
    const listaCont = document.getElementById('historial-ventas-list');
    // Ordenamos las fechas de forma descendente (más nueva primero)
    const fechasOrdenadas = Object.keys(ventasPorDia).sort((a, b) => b.localeCompare(a)); 

    if (fechasOrdenadas.length === 0) {
        listaCont.innerHTML = '<p>No se encontraron ventas registradas en los últimos 7 días.</p>';
        return;
    }

    fechasOrdenadas.forEach(fecha => {
        const dataDia = ventasPorDia[fecha];
        // Los datos ya vienen agrupados y contienen la lista de ventas dentro de 'dataDia.ventas'
        
        // Filtramos para asegurar que solo se muestren los días que tienen ventas guardadas
        if (dataDia.ventas && dataDia.ventas.length === 0) return;
        
        const fechaLegible = new Date(fecha + 'T00:00:00').toLocaleDateString('es-AR', { dateStyle: 'full' });

        const divDia = document.createElement('div');
        divDia.className = 'historial-dia';
        
        divDia.innerHTML = `
            <h3>
                ${fechaLegible}
                <span class="total-final-dia">${formatearPrecio(dataDia.ganancia).replace(/\u00A0/g, ' ')}</span>
            </h3>
            <div class="ventas-del-dia">
                ${dataDia.ventas.map((venta, index) => `
                    <div class="historial-item">
                        <div class="item-detalle">
                            <span style="font-weight:700;">#${dataDia.ventas.length - index} |</span>
                            <span style="color:#777;">Final: ${formatearPrecio(venta.totalFinal).replace(/\u00A0/g, ' ')}</span>
                            ${venta.montoDescuento > 0 ? `<span style="color:var(--rojo); font-weight:600;">(Dto: ${venta.porcentajeDescuento}%)</span>` : ''}
                        </div>
                        <div style="text-align:right;">
                            ${venta.items.map(item => `
                                <div style="font-weight:400;">${item.cantidad}x ${item.nombre}</div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        listaCont.appendChild(divDia);
    });
}


// ---------------------- GENERACIÓN DE PDF ----------------------
function generarPDFStock() {
    // 1. Ordenamos los productos por nombre
    const productosOrdenados = productos.slice().sort((a, b) => {
        const nombreA = a.data.nombre || "";
        const nombreB = b.data.nombre || "";
        return nombreA.localeCompare(nombreB);
    });

    // 2. Encabezados de la tabla para el PDF
    const headers = [
        ['Nombre', 'Marca', 'Precio', 'Stock']
    ];
    
    // 3. Mapeamos los datos para autoTable
    const data = productosOrdenados.map(p => [
        p.data.nombre || 'Sin nombre',
        p.data.marca || '-',
        formatearPrecio(p.data.precio || 0),
        (p.data.stock === undefined || p.data.stock === null) ? '-' : p.data.stock.toString()
    ]);

    // 4. Inicializamos jsPDF (usando el objeto global window.jspdf)
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // 5. Título y Fecha
    doc.setFontSize(18);
    doc.text("Reporte de Stock - Thor Herramientas", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Generado el: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 26);
    
    // 6. Generamos la tabla
    doc.autoTable({
        startY: 30, // Posición inicial de la tabla
        head: headers,
        body: data,
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [255, 214, 0], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
            2: { halign: 'right', cellWidth: 30 }, 
            3: { halign: 'center' } 
        },
        didDrawPage: function (data) {
            // Footer (Número de página)
            doc.setFontSize(8)
            let pageCount = doc.internal.getNumberOfPages()
            doc.text('Página ' + data.pageNumber + ' de ' + pageCount, data.settings.margin.left, doc.internal.pageSize.height - 10)
        }
    });

    // 7. Descargar el archivo
    doc.save(`Stock_ThorHerramientas_${new Date().toISOString().slice(0, 10)}.pdf`);
}


document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-producto");
  const tbody = document.getElementById("tabla-productos-body");
  const inputBuscador = document.getElementById("buscador-admin");
  const btnDescargarPDF = document.getElementById("btn-descargar-stock-pdf"); 
  
  // NUEVOS BOTONES DE VENTA
  const btnRealizarVenta = document.getElementById('btn-realizar-venta');
  const inputCodBarraVenta = document.getElementById('venta-input-codbarra');
  const btnVaciarVenta = document.getElementById('btn-vaciar-venta');
  const btnConfirmarVenta = document.getElementById('btn-confirmar-venta');
  
  // NUEVOS CONTROLES DE DESCUENTO
  const inputDescuento = document.getElementById('venta-input-descuento');
  const btnAplicarDescuento = document.getElementById('btn-aplicar-descuento');
  const btnQuitarDescuento = document.getElementById('btn-quitar-descuento');
  
  // BOTONES DE NAVEGACIÓN
  const btnShowProductos = document.getElementById('btn-show-productos');
  const btnShowHistorial = document.getElementById('btn-show-historial');
  
  // Cargar productos
  cargarProductosDesdeFirestore().catch(err => {
    console.error("Error cargando productos:", err);
    alert("Hubo un problema cargando los productos.");
  });
  
  // Asignar evento al botón de descarga de PDF
  if (btnDescargarPDF) {
      btnDescargarPDF.addEventListener("click", generarPDFStock);
  }

  // BOTONES DE NAVEGACIÓN (Escuchadores)
  if (btnShowProductos) btnShowProductos.addEventListener('click', () => mostrarPanel('productos'));
  if (btnShowHistorial) btnShowHistorial.addEventListener('click', () => cargarHistorialVentas());

  // Buscar en vivo (Tabla de productos principal)
  if (inputBuscador) {
    inputBuscador.addEventListener("input", () => {
      filtroTexto = inputBuscador.value.trim();
      renderTablaProductos();
    });
  }

  // **********************************************
  // Lógica del Formulario de Productos (GUARDAR/EDITAR)
  // **********************************************
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); 

    const id = document.getElementById("prod-id").value.trim();
    const nombre = document.getElementById("prod-nombre").value.trim();
    const marca = document.getElementById("prod-marca").value.trim();
    const precio = Number(document.getElementById("prod-precio").value || 0);
    const stock = Number(document.getElementById("prod-stock").value || 0);
    const alimentacion = document.getElementById("prod-alimentacion").value;
    const codbarra = document.getElementById("prod-codbarra").value.trim(); // Campo Código de Barras
    const imagenTexto = document.getElementById("prod-imagen").value.trim();
    const descripcion = document.getElementById("prod-descripcion").value.trim();
    const enviosText = document.getElementById("prod-envios").value;
    const detallesText = document.getElementById("prod-detalles").value;

    if (!nombre) {
      alert("El nombre es obligatorio.");
      return;
    }

    const opcionesEnvio = enviosText.split(",").map(t => t.trim()).filter(Boolean);
    const detalles = detallesText.split("\n").map(t => t.trim()).filter(Boolean);

    const imagenes = imagenTexto
      ? imagenTexto.split(",").map(u => u.trim()).filter(Boolean)
      : [];
    const imagenPlaceholder = "https://via.placeholder.com/300x200?text=Producto";
    const imagenPrincipal = imagenes.length > 0 ? imagenes[0] : imagenPlaceholder;

    const producto = {
      nombre,
      marca,
      precio,
      stock,
      alimentacion, 
      codbarra, // Campo Código de Barras
      imagen: imagenPrincipal,
      imagenes,
      descripcion,
      opcionesEnvio,
      detalles
    };

    try {
      if (id) {
        // Lógica de EDICIÓN (UPDATE)
        await productosRef.doc(id).update(producto);
        alert("Producto actualizado correctamente.");
      } else {
        // Lógica de CREACIÓN (ADD)
        await productosRef.add(producto);
        alert("Producto creado correctamente.");
      }
      
      limpiarFormulario();
      await cargarProductosDesdeFirestore(); // Recarga la lista para ver el cambio
      
    } catch (err) {
      console.error("Error guardando producto:", err);
      alert("Hubo un error guardando el producto.");
    }
  });

  // ------------- LISTENERS VENTA RÁPIDA -------------
  if (btnRealizarVenta) btnRealizarVenta.addEventListener('click', abrirVenta);
  if (btnVaciarVenta) btnVaciarVenta.addEventListener('click', vaciarVenta);
  if (btnConfirmarVenta) btnConfirmarVenta.addEventListener('click', confirmarVenta);

  // LISTENER DE AUTOSUGERENCIAS
  if (inputCodBarraVenta) {
    // Al escribir, buscar y mostrar sugerencias
    inputCodBarraVenta.addEventListener('input', liveSearchVenta);
    
    // Si el usuario presiona ENTER, intenta agregar el producto
    inputCodBarraVenta.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const codbarra = inputCodBarraVenta.value.trim();
            
            const resultados = buscarProductoParaVenta(codbarra);
            
            // Si hay una única coincidencia (ya sea por código exacto o nombre exacto)
            if (resultados.length === 1) {
                agregarProductoEncontrado(resultados[0]);
                inputCodBarraVenta.value = '';
                renderVentaSuggestions([]);
            } else {
                 alert("Por favor, seleccione un producto de la lista o refine su búsqueda.");
            }
        }
    });
    
    // Al perder el foco (si no es porque seleccionó algo), ocultar la lista
    inputCodBarraVenta.addEventListener('blur', () => {
         // Se añade un pequeño retraso para permitir que el evento 'click' en la sugerencia se dispare primero.
         setTimeout(() => renderVentaSuggestions([]), 200);
    });
  }


  // LISTENERS DE DESCUENTO
  if (btnAplicarDescuento) btnAplicarDescuento.addEventListener('click', aplicarDescuento);
  if (btnQuitarDescuento) btnQuitarDescuento.addEventListener('click', quitarDescuento);
  
  if (inputDescuento) {
    // Aplicar descuento al presionar Enter o perder el foco
    inputDescuento.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            aplicarDescuento();
        }
    });
    inputDescuento.addEventListener('blur', aplicarDescuento);
  }

  
  // Escucha los clics en la tabla para +/- y Editar/Eliminar
  tbody.addEventListener("click", async (e) => {
    const accion = e.target.dataset.accion;
    const id = e.target.dataset.id;
    const delta = e.target.dataset.delta; // Para los botones de stock
    
    if (!id) return;

    if (e.target.classList.contains("btn-stock-quick")) {
        // Lógica de STOCK RÁPIDO (+ / -)
        if (delta) {
            await actualizarStockRapido(id, Number(delta));
        }
        return;
    }

    const prodEntry = productos.find(p => p.id === id);
    if (!prodEntry) return;

    if (accion === "editar") {
      cargarProductoEnFormulario(id, prodEntry.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (accion === "eliminar") {
      const confirmar = confirm(`¿Seguro que querés eliminar "${prodEntry.data.nombre}"?`);
      if (!confirmar) return;
      try {
        await productosRef.doc(id).delete();
        await cargarProductosDesdeFirestore(); // refresca lista + estadísticas
        alert("Producto eliminado.");
      } catch (err) {
        console.error("Error eliminando producto:", err);
        alert("No se pudo eliminar el producto.");
      }
    }
  });
  
  // NUEVO LISTENER: Escucha el cambio de valor en el input de stock
  tbody.addEventListener("change", async (e) => {
    if (e.target.classList.contains("stock-input-edit")) {
      const id = e.target.dataset.id;
      const nuevoValor = e.target.value;
      await actualizarStockRapidoPorInput(id, nuevoValor);
    }
  });
  
  // Limpiar formulario al hacer clic en el botón
  document.getElementById("btn-limpiar-form").addEventListener("click", () => limpiarFormulario());
});
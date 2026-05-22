// Colecciones de Firestore
const productosRef = db.collection("productos");
const COLECCION_VENTAS = "ventas"; 

let productos = []; 		// [{id, data}]
let filtroTexto = ""; 	  // texto del buscador
let ventaActual = [];   // [{id: string, cantidad: number, precio: number, nombre: string}] 
let porcentajeDescuento = 0; 
let soloAgotados = false; 
let myChartGanancia = null; 
let myChartProductos = null;
let myChartTransacciones = null;

function formatearPrecio(numero) {
  const numRedondeado = Math.round(Number(numero) || 0);
  return numRedondeado.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0
  }).replace(/\s/g, '\u00A0'); 
}

function toggleFormularioProducto(forzarAbrir = null) {
  const wrapper = document.getElementById("wrapper-formulario-producto");
  const btn = document.getElementById("btn-toggle-formulario");
  if (!wrapper || !btn) return;

  const estaAbierto = wrapper.classList.contains("abierto");
  const debeAbrir = (forzarAbrir !== null) ? forzarAbrir : !estaAbierto;

  if (debeAbrir) {
    wrapper.classList.add("abierto");
    btn.innerHTML = "➖ Cerrar formulario";
    btn.style.backgroundColor = "var(--rojo)";
  } else {
    wrapper.classList.remove("abierto");
    btn.innerHTML = "➕ Agregar nuevo producto";
    btn.style.backgroundColor = "#2e7d32";
    limpiarFormulario();
  }
}

function limpiarFormulario() {
  document.getElementById("prod-id").value = "";
  document.getElementById("prod-nombre").value = "";
  document.getElementById("prod-sku").value = ""; 
  document.getElementById("prod-marca").value = "";
  document.getElementById("prod-costo").value = ""; 
  document.getElementById("prod-precio").value = "";
  document.getElementById("prod-stock").value = "";
  document.getElementById("prod-codbarra").value = ""; 
  document.getElementById("prod-alimentacion").value = "Otro"; 
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
  toggleFormularioProducto(true);

  document.getElementById("prod-id").value = id;
  document.getElementById("prod-nombre").value = prod.nombre || "";
  document.getElementById("prod-sku").value = prod.sku || ""; 
  document.getElementById("prod-marca").value = prod.marca || "";
  document.getElementById("prod-costo").value = prod.costo || ""; 
  document.getElementById("prod-precio").value = prod.precio || 0;
  document.getElementById("prod-stock").value = prod.stock || 0;
  document.getElementById("prod-codbarra").value = prod.codbarra || ""; 
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
  let listaFiltrada = productos;

  if (soloAgotados) {
    listaFiltrada = listaFiltrada.filter(p => (Number(p.data.stock) ?? 0) === 0);
  }

  if (!filtroTexto) return listaFiltrada;
  const t = filtroTexto.toLowerCase().trim();
  
  const tNormalizado = filtroTexto.replace(/[^a-zA-Z0-9\s]/g, "").toLowerCase();
  const keywords = tNormalizado.split(/\s+/).filter(k => k.length > 0);

  return listaFiltrada.filter(p => {
    const d = p.data;
    const searchableText = (d.nombre || '') + ' ' + (d.sku || '') + ' ' + (d.descripcion || '') + ' ' + (d.marca || '');
    const searchableTextLower = searchableText.toLowerCase();

    const keywordMatch = keywords.every(keyword => searchableTextLower.includes(keyword));

    const codigosGuardados = d.codbarra ? d.codbarra.split(',') : [];
    
    const codbarraMatch = codigosGuardados.some(cod => {
        const codbarraGuardadoNormalizado = cod.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        return codbarraGuardadoNormalizado.includes(tNormalizado);
    });
    
    return keywordMatch || codbarraMatch; 
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
  
  if (elAgo) {
    elAgo.textContent = agotados;
    if (agotados > 0) {
      elAgo.style.color = "var(--rojo)";
      elAgo.style.fontWeight = "800";
    } else {
      elAgo.style.color = "#222";
      elAgo.style.fontWeight = "800";
    }
  }
  if (elVal) elVal.textContent = formatearPrecio(valorTotal);
}
/* ========================== */

function renderTablaProductos() {
  const tbody = document.getElementById("tabla-productos-body");
  tbody.innerHTML = "";

  const lista = productosFiltrados();

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9">No se encontraron productos en esta vista.</td></tr>`;
    return;
  }

  lista.forEach(p => {
    const stock = Number(p.data.stock) ?? 0;
    const costo = Number(p.data.costo) ?? 0;
    const precio = Number(p.data.precio) ?? 0;
    const gananciaIndividual = precio - costo;

    let estiloFila = "";
    if (stock === 0) {
      estiloFila = 'style="background-color: #fce4e4;"'; 
    } else if (stock <= 2) {
      estiloFila = 'style="background-color: #fff3e0;"'; 
    }

    const tr = document.createElement("tr");
    if (estiloFila) tr.setAttribute("style", estiloFila.split('"')[1]); 

    // FIX Y ACTUALIZACIÓN: Se incorporaron las clases de columnas correspondientes (col-sku, col-nombre, col-marca)
    tr.innerHTML = `
      <td class="col-sku" style="font-weight: 600; color: #555; font-family: monospace;">
        ${p.data.sku || "-"}
      </td>
      <td class="col-nombre">
        ${p.data.nombre || "-"}
        ${stock === 0 ? ' <span style="color:var(--rojo); font-weight:bold; font-size:11px;">[AGOTADO]</span>' : ''}
        ${stock > 0 && stock <= 2 ? ' <span style="color:#e65100; font-weight:bold; font-size:11px;">[STOCK CRÍTICO]</span>' : ''}
      </td>
      <td class="col-marca">${p.data.marca || "-"}</td>
      <td class="col-precio">
        <div style="display:flex; align-items:center; gap:2px;">
          <span style="color:#777; font-size: 12px;">$</span>
          <input type="number" id="costo-input-${p.id}" value="${costo}" min="0" step="1" data-id="${p.id}"
              style="width: 80px; border: 1px solid #ccc; border-radius: 4px; padding: 2px 4px; font-size: 13px; background-color: #fafafa;" 
              class="costo-input-edit"
          >
        </div>
      </td>
      <td class="col-precio">
        <div style="display:flex; align-items:center; gap:2px;">
          <span style="color:#555; font-weight:500;">$</span>
          <input type="number" id="precio-input-${p.id}" value="${precio}" min="0" step="1" data-id="${p.id}"
              style="width: 85px; border: 1px solid #ccc; border-radius: 4px; padding: 2px 4px; font-size: 13px;" 
              class="precio-input-edit"
          >
        </div>
      </td>
      <td class="col-ganancia" style="font-weight: 700; color: ${gananciaIndividual >= 0 ? '#2e7d32' : 'var(--rojo)'};">
        ${formatearPrecio(gananciaIndividual)}
      </td>
      <td class="col-stock" style="text-align: center;">
        <div class="stock-controls" data-id="${p.id}" style="display:flex; align-items:center; justify-content:center; gap:4px;">
            <button class="btn-stock-quick" data-delta="-1" data-id="${p.id}" style="
                padding: 1px 6px; border: 1px solid #ccc; background: #f0f0f0; cursor: pointer; border-radius: 4px; font-weight: bold;
            ">-</button>
            <input type="number" id="stock-input-${p.id}" value="${stock}" min="0" data-id="${p.id}"
                style="width: 45px; text-align: center; border: 1px solid #ccc; border-radius: 4px; padding: 1px; font-weight: ${stock <= 2 ? 'bold' : 'normal'};" 
                class="stock-input-edit"
            >
            <button class="btn-stock-quick" data-delta="+1" data-id="${p.id}" style="
                padding: 1px 5px; border: 1px solid #ccc; background: #f0f0f0; cursor: pointer; border-radius: 4px; font-weight: bold;
            ">+</button>
        </div>
      </td>
      <td class="col-alimentacion">${p.data.alimentacion || "-"}</td>
      <td class="col-acciones">
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

async function actualizarCostoRapidoPorInput(idProducto, nuevoValor) {
    const prodEntry = productos.find(p => p.id === idProducto);
    if (!prodEntry) return;

    let nuevoCosto = Number(nuevoValor);
    if (isNaN(nuevoCosto) || nuevoCosto < 0) {
        mostrarAlertaStock("Precio de costo inválido.");
        const inputEl = document.getElementById(`costo-input-${idProducto}`);
        if(inputEl) inputEl.value = prodEntry.data.costo ?? 0;
        return;
    }
    nuevoCosto = Math.round(nuevoCosto);

    try {
        await productosRef.doc(idProducto).update({ costo: nuevoCosto });
        prodEntry.data.costo = nuevoCosto; 
        renderTablaProductos();
    } catch (err) {
        console.error("Error actualizando costo rápido:", err);
    }
}

async function actualizarPrecioRapidoPorInput(idProducto, nuevoValor) {
    const prodEntry = productos.find(p => p.id === idProducto);
    if (!prodEntry) return;

    let nuevoPrecio = Number(nuevoValor);
    if (isNaN(nuevoPrecio) || nuevoPrecio < 0) {
        mostrarAlertaStock("Valor de precio inválido. Debe ser un número positivo.");
        const inputEl = document.getElementById(`precio-input-${idProducto}`);
        if(inputEl) inputEl.value = prodEntry.data.precio ?? 0;
        return;
    }
    nuevoPrecio = Math.round(nuevoPrecio);

    try {
        await productosRef.doc(idProducto).update({ precio: nuevoPrecio });
        prodEntry.data.precio = nuevoPrecio; 
        renderTablaProductos();
        renderEstadisticas();
    } catch (err) {
        console.error("Error actualizando precio por input:", err);
        mostrarAlertaStock("Hubo un error al actualizar el precio.");
    }
}

async function actualizarStockRapidoPorInput(idProducto, nuevoValor) {
    const prodEntry = productos.find(p => p.id === idProducto);
    if (!prodEntry) return;

    let nuevoStock = Number(nuevoValor);
    if (isNaN(nuevoStock) || nuevoStock < 0) {
        mostrarAlertaStock("Valor de stock inválido. Debe ser un número positivo.");
        const inputEl = document.getElementById(`stock-input-${idProducto}`);
        if(inputEl) inputEl.value = prodEntry.data.stock ?? 0;
        return;
    }
    nuevoStock = Math.round(nuevoStock);

    try {
        await productosRef.doc(idProducto).update({ stock: nuevoStock });
        prodEntry.data.stock = nuevoStock; 
        renderTablaProductos();
        renderEstadisticas();
    } catch (err) {
        console.error("Error actualizando stock por input:", err);
        mostrarAlertaStock("Hubo un error al actualizar el stock.");
    }
}

async function actualizarStockRapido(idProducto, delta) {
    const prodEntry = productos.find(p => p.id === idProducto);
    if (!prodEntry) return;

    const stockActual = Number(prodEntry.data.stock) || 0;
    const nuevoStock = stockActual + delta;

    if (nuevoStock < 0) {
        mostrarAlertaStock(`El stock no puede ser negativo para ${prodEntry.data.nombre}. Stock actual: ${stockActual}`);
        return;
    }

    try {
        await productosRef.doc(idProducto).update({ stock: nuevoStock });
        prodEntry.data.stock = nuevoStock; 
        renderTablaProductos();
        renderEstadisticas();
    } catch (err) {
        console.error("Error actualizando stock:", err);
        mostrarAlertaStock("Hubo un error al actualizar el stock.");
    }
}

// ---------------------- FUNCIONALIDAD VENTA RÁPIDA (POS) ----------------------

function mostrarAlertaStock(mensaje) {
    const alertaDiv = document.getElementById('venta-alerta-stock');
    const mensajeSpan = document.getElementById('venta-alerta-mensaje');
    const inputCodBarraVenta = document.getElementById('venta-input-codbarra');
    
    if (!alertaDiv || !mensajeSpan) {
        alert(mensaje);
        return;
    }

    mensajeSpan.textContent = mensaje;
    alertaDiv.classList.remove('oculto');
    alertaDiv.style.display = 'flex';
    
    const cerrarAlerta = () => {
        alertaDiv.classList.add('oculto');
        alertaDiv.style.display = 'none';
        if (inputCodBarraVenta) inputCodBarraVenta.focus();
    };

    const btnCerrar = document.getElementById('btn-cerrar-alerta-stock');
    if (btnCerrar) {
        const newBtnCerrar = btnCerrar.cloneNode(true);
        btnCerrar.parentNode.replaceChild(newBtnCerrar, btnCerrar);
        newBtnCerrar.addEventListener('click', cerrarAlerta);
    }
    
    const handleKey = (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
            cerrarAlerta();
            document.removeEventListener('keydown', handleKey);
        }
    };
    document.addEventListener('keydown', handleKey);
}

function vaciarVenta() {
    ventaActual = [];
    porcentajeDescuento = 0; 
    const inputDescuento = document.getElementById('venta-input-descuento');
    if (inputDescuento) inputDescuento.value = ''; 
    renderVentaPanel();
    renderVentaSuggestions([]); 
}

function eliminarItemVenta(idProducto) {
    const confirmar = confirm("¿Estás seguro de que deseas eliminar este producto de la venta?");
    if (!confirmar) return;
    
    ventaActual = ventaActual.filter(item => item.id !== idProducto);
    
    if (ventaActual.length === 0) {
        porcentajeDescuento = 0;
        const inputDescuento = document.getElementById('venta-input-descuento');
        if (inputDescuento) inputDescuento.value = '';
    }

    renderVentaPanel(); 
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

function aplicarDescuento() {
    const inputDescuento = document.getElementById('venta-input-descuento');
    if (!inputDescuento) return;

    let porcentaje = Number(inputDescuento.value) || 0;
    
    if (porcentaje < 0 || porcentaje > 100) {
        mostrarAlertaStock("El descuento debe ser un porcentaje entre 0 y 100.");
        porcentaje = Math.min(100, Math.max(0, porcentaje)); 
        inputDescuento.value = porcentaje;
    }

    porcentajeDescuento = porcentaje;
    renderVentaPanel();
}

function quitarDescuento() {
    const inputDescuento = document.getElementById('venta-input-descuento');
    if (inputDescuento) inputDescuento.value = '';
    porcentajeDescuento = 0; 
    renderVentaPanel();
}

function renderVentaPanel() {
    const listaDiv = document.getElementById('venta-items-list');
    const totalSinDtoSpan = document.getElementById('venta-total-sin-dto-display');
    const descuentoAplicadoSpan = document.getElementById('venta-descuento-aplicado-display');
    const totalFinalSpan = document.getElementById('venta-total-final-display');
    const btnConfirmar = document.getElementById('btn-confirmar-venta');
    
    const totalSinDescuento = ventaActual.reduce((total, item) => total + (item.precio * item.cantidad), 0);
    const montoDescuento = totalSinDescuento * (porcentajeDescuento / 100);
    const totalFinal = Math.max(0, totalSinDescuento - montoDescuento); 

    listaDiv.innerHTML = '';

    if (ventaActual.length === 0) {
        listaDiv.innerHTML = '<p style="color:#777;">No hay productos en la venta.</p>';
        btnConfirmar.disabled = true;
    } else {
        ventaActual.forEach(item => {
            const subtotal = item.precio * item.cantidad;
            
            const div = document.createElement('div');
            div.className = 'venta-item-row'; 
            div.innerHTML = `
                <span style="font-weight:600; flex-shrink: 0; margin-right: 8px;">${item.cantidad}x</span> 
                <span style="flex-grow: 1;">${item.nombre}</span>
                <span style="font-weight: 600; flex-shrink: 0; margin-left: 8px;">${formatearPrecio(subtotal).replace(/\u00A0/g, ' ')}</span>
                <button class="btn-eliminar-venta-item" data-id="${item.id}" title="Eliminar este ítem">🗑</button>
            `;
            listaDiv.appendChild(div);
        });
        btnConfirmar.disabled = false;
    }

    totalSinDtoSpan.textContent = formatearPrecio(totalSinDescuento).replace(/\u00A0/g, ' ');
    descuentoAplicadoSpan.textContent = formatearPrecio(montoDescuento).replace(/\u00A0/g, ' ');
    totalFinalSpan.textContent = formatearPrecio(totalFinal).replace(/\u00A0/g, ' ');
}

function buscarProductoParaVenta(input) {
    if (!input) return [];
    
    const inputLower = input.toLowerCase().trim();
    const inputNormalizado = input.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

    const matchBySkuOrBarcode = productos.find(p => {
        const skuNormalizado = (p.data.sku || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        if (skuNormalizado === inputNormalizado) return true;

        const codigosGuardados = p.data.codbarra ? p.data.codbarra.split(',') : [];
        return codigosGuardados.some(cod => {
            const codbarraGuardadoNormalizado = cod.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
            return codbarraGuardadoNormalizado === inputNormalizado; 
        });
    });
    if (matchBySkuOrBarcode) return [matchBySkuOrBarcode]; 

    const keywords = inputLower.split(/\s+/).filter(k => k.length > 0);
    
    const matchesByKeyword = productos.filter(p => {
        const d = p.data;
        const searchableText = (d.nombre || '') + ' ' + (d.sku || '') + ' ' + (d.descripcion || '') + ' ' + (d.marca || '');
        const searchableTextLower = searchableText.toLowerCase();
        const keywordMatch = keywords.every(keyword => searchableTextLower.includes(keyword));
        return keywordMatch;
    });

    return matchesByKeyword; 
}

function agregarProductoEncontrado(productoEnStock) {
    const itemEnVenta = ventaActual.find(item => item.id === productoEnStock.id);
    const stockDisponible = Number(productoEnStock.data.stock) || 0;
    const cantidadActualVenta = itemEnVenta ? itemEnVenta.cantidad : 0;

    if (stockDisponible <= cantidadActualVenta) {
        mostrarAlertaStock(`Stock agotado o insuficiente de "${productoEnStock.data.nombre}". Stock disponible: ${stockDisponible}.`);
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

function liveSearchVenta() {
    const inputEl = document.getElementById('venta-input-codbarra');
    const input = inputEl.value;
    
    if (input.length < 2) {
        renderVentaSuggestions([]);
        return;
    }

    const resultados = buscarProductoParaVenta(input);
    
    if (resultados.length === 1 && resultados[0].data.codbarra && resultados[0].data.codbarra.includes(input)) {
         agregarProductoEncontrado(resultados[0]);
         inputEl.value = ''; 
         renderVentaSuggestions([]); 
         return;
    }
    
    renderVentaSuggestions(resultados.slice(0, 8)); 
}

function renderVentaSuggestions(sugerencias) {
    const listaSugerencias = document.getElementById('venta-sugerencias-list');
    const inputEl = document.getElementById('venta-input-codbarra');
    
    if (!inputEl.value.trim() || sugerencias.length === 0) {
        listaSugerencias.classList.add('oculto');
        listaSugerencias.innerHTML = '';
        return;
    }

    listaSugerencias.innerHTML = '';

    sugerencias.forEach(p => {
        const div = document.createElement('div');
        div.className = 'sugerencia-item';
        div.dataset.id = p.id; 
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
                inputEl.value = ''; 
                inputEl.focus(); 
            }
            renderVentaSuggestions([]); 
        });
        listaSugerencias.appendChild(div);
    });

    listaSugerencias.classList.remove('oculto');
}

async function confirmarVenta() {
    if (ventaActual.length === 0) return;

    try {
        const updates = await db.runTransaction(async (transaction) => {
            const resultList = [];
            
            const readPromises = ventaActual.map(item => {
                const docRef = productosRef.doc(item.id);
                return transaction.get(docRef);
            });
            
            const docs = await Promise.all(readPromises);

            for (let i = 0; i < ventaActual.length; i++) {
                const item = ventaActual[i];
                const doc = docs[i];

                if (!doc.exists) {
                    throw new Error(`El producto "${item.nombre}" no existe en la base de datos.`);
                }
                
                const data = doc.data();
                const stockActual = Number(data.stock) || 0;
                const nuevoStock = stockActual - item.cantidad;

                if (nuevoStock < 0) {
                    throw new Error(`Stock insuficiente para "${item.nombre}". Disponible: ${stockActual}, solicitado: ${item.cantidad}.`);
                }

                transaction.update(doc.ref, { stock: nuevoStock });
                resultList.push({ id: item.id, nuevoStock: nuevoStock });
            }

            return resultList;
        });

        updates.forEach(update => {
            const prodEntry = productos.find(p => p.id === update.id);
            if (prodEntry) prodEntry.data.stock = update.nuevoStock;
        });

        const totalSinDto = ventaActual.reduce((t, i) => t + i.precio * i.cantidad, 0);
        const montoDescuento = totalSinDto * (porcentajeDescuento / 100);
        const totalFinalVenta = totalSinDto - montoDescuento;

        const ventaData = {
            fecha: firebase.firestore.FieldValue.serverTimestamp(),
            fechaString: new Date().toISOString().split('T')[0],
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

        alert(`Venta confirmada exitosamente.`);
        
        vaciarVenta();
        renderTablaProductos();
        renderEstadisticas();
        cerrarVenta(); 

    } catch (error) {
        console.error("Error en la transacción:", error);
        alert(`Error al confirmar la venta: ${error.message}`);
    }
}

// ---------------------- HISTORIAL DE VENTAS Y GRÁFICOS ----------------------

function procesarDatosParaGraficos(ventas) {
    const fechas = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        fechas.push(d.toISOString().split('T')[0]);
    }
    
    const datosDiarios = {}; 
    const datosProductos = {}; 

    fechas.forEach(fecha => {
        datosDiarios[fecha] = { ganancia: 0, transacciones: 0, ventas: [] };
    });

    ventas.forEach(venta => {
        if (!venta.fechaString) return; 

        const fecha = venta.fechaString;
        
        if (datosDiarios[fecha]) {
            datosDiarios[fecha].ganancia += venta.totalFinal || 0;
            datosDiarios[fecha].transacciones += 1;
            datosDiarios[fecha].ventas.push(venta); 
        } else {
            return;
        }

        if (venta.items && Array.isArray(venta.items)) {
            venta.items.forEach(item => {
                if (!item.nombre || item.cantidad === undefined) return;
                const nombre = item.nombre;
                const cantidad = item.cantidad || 0;
                datosProductos[nombre] = (datosProductos[nombre] || 0) + cantidad;
            });
        }
    });
    
    const etiquetasFecha = fechas.map(f => new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }));
    const valoresGanancia = fechas.map(f => datosDiarios[f].ganancia);
    const valoresTransacciones = fechas.map(f => datosDiarios[f].transacciones);
    
    const topProductos = Object.entries(datosProductos)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    const etiquetasProductos = topProductos.map(([nombre]) => nombre);
    const valoresProductos = topProductos.map(([, cantidad]) => cantidad);
    
    return {
        ventasPorDia: datosDiarios, 
        ganancia: { labels: etiquetasFecha, data: valoresGanancia },
        productos: { labels: etiquetasProductos, data: valoresProductos },
        transacciones: { labels: etiquetasFecha, data: valoresTransacciones }
    };
}

function dibujarGraficos(datos) {
    if (myChartGanancia) myChartGanancia.destroy();
    if (myChartProductos) myChartProductos.destroy();
    if (myChartTransacciones) myChartTransacciones.destroy();
    
    const formatPriceTooltip = (value) => formatearPrecio(value).replace(/\u00A0/g, ' ');

    const canvasGanancia = document.getElementById('grafico-ganancia-diaria');
    if (canvasGanancia) {
        const ctxGanancia = canvasGanancia.getContext('2d');
        myChartGanancia = new Chart(ctxGanancia, {
            type: 'bar',
            data: {
                labels: datos.ganancia.labels,
                datasets: [{
                    label: 'Ganancia Final (ARS)',
                    data: datos.ganancia.data,
                    backgroundColor: 'rgba(0, 166, 80, 0.7)', 
                    borderColor: 'rgba(0, 166, 80, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: { 
                        beginAtZero: true, 
                        title: { display: true, text: 'Monto (ARS)' },
                        ticks: {
                            callback: function(value) { return formatPriceTooltip(value); }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { 
                        callbacks: { label: (context) => `ARS ${formatPriceTooltip(context.parsed.y).replace('$', '')}` } 
                    }
                }
            }
        });
    }

    const canvasProductos = document.getElementById('grafico-productos-vendidos');
    if (canvasProductos) {
        const ctxProductos = canvasProductos.getContext('2d');
        myChartProductos = new Chart(ctxProductos, {
            type: 'doughnut',
            data: {
                labels: datos.productos.labels,
                datasets: [{
                    label: 'Cantidad Vendida',
                    data: datos.productos.data,
                    backgroundColor: ['#1976d2', '#ffd600', '#c62828', '#2e7d32', '#9c27b0'], 
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: { display: false },
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    const canvasTransacciones = document.getElementById('grafico-transacciones-diarias');
    if (canvasTransacciones) {
        const ctxTransacciones = canvasTransacciones.getContext('2d');
        myChartTransacciones = new Chart(ctxTransacciones, {
            type: 'line',
            data: {
                labels: datos.transacciones.labels,
                datasets: [{
                    label: 'Transacciones',
                    data: datos.transacciones.data,
                    backgroundColor: 'rgba(25, 118, 210, 0.2)', 
                    borderColor: 'rgba(25, 118, 210, 1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Número de Ventas' }, ticks: { precision: 0 } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

async function cargarHistorialVentas() {
    const listaCont = document.getElementById('historial-ventas-list');
    const loader = document.getElementById('historial-loader');
    
    listaCont.innerHTML = '';
    loader.style.display = 'block';

    try {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); 
        const haceSieteDias = new Date(hoy);
        haceSieteDias.setDate(hoy.getDate() - 7); 
        const timestampLimite = firebase.firestore.Timestamp.fromDate(haceSieteDias);

        const snapshot = await db.collection(COLECCION_VENTAS)
            .where('fecha', '>=', timestampLimite)
            .get(); 
        
        const ventas = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(venta => venta.fechaString); 
        
        ventas.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));

        const datosProcesados = procesarDatosParaGraficos(ventas);
        dibujarGraficos(datosProcesados);
        renderHistorialVentas(datosProcesados.ventasPorDia);

    } catch (e) {
        console.error("Error cargando historial de ventas.", e);
        listaCont.innerHTML = '<p style="color:#c62828;">Error al cargar o procesar el historial de ventas.</p>';
    } finally {
        loader.style.display = 'none';
    }
}

function renderHistorialVentas(ventasPorDia) {
    const listaCont = document.getElementById('historial-ventas-list');
    const fechasOrdenadas = Object.keys(ventasPorDia).sort((a, b) => b.localeCompare(a)); 

    if (fechasOrdenadas.length === 0) {
        listaCont.innerHTML = '<p>No se encontraron ventas registradas en los últimos 7 días.</p>';
        return;
    }

    fechasOrdenadas.forEach(fecha => {
        const dataDia = ventasPorDia[fecha];
        if (!dataDia || !dataDia.ventas || dataDia.ventas.length === 0) return;
        
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
                            <span style="color:#777;">Final: ${formatearPrecio(venta.totalFinal || 0).replace(/\u00A0/g, ' ')}</span>
                            ${(venta.montoDescuento || 0) > 0 ? `<span style="color:#c62828; font-weight:600;">(Dto: ${venta.porcentajeDescuento || 0}%)</span>` : ''}
                        </div>
                        <div style="text-align:right;">
                            ${(venta.items || []).map(item => `
                                <div style="font-weight:400;">${item.cantidad || 0}x ${item.nombre || 'Producto Desconocido'}</div>
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
    const productosOrdenados = productos.slice().sort((a, b) => {
        const nombreA = a.data.nombre || "";
        const nombreB = b.data.nombre || "";
        return nombreA.localeCompare(nombreB);
    });

    const headers = [['SKU', 'Nombre', 'Marca', 'Precio Costo', 'Precio Venta', 'Stock']];
    const data = productosOrdenados.map(p => [
        p.data.sku || '-',
        p.data.nombre || 'Sin nombre',
        p.data.marca || '-',
        formatearPrecio(p.data.costo || 0),
        formatearPrecio(p.data.precio || 0),
        (p.data.stock === undefined || p.data.stock === null) ? '-' : p.data.stock.toString()
    ]);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Reporte de Stock - Thor Herramientas", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generado el: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 26);
    
    doc.autoTable({
        startY: 30, 
        head: headers,
        body: data,
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [255, 214, 0], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 25 },
            3: { halign: 'right', cellWidth: 26 }, 
            4: { halign: 'right', cellWidth: 26 }, 
            5: { halign: 'center' } 
        },
        didDrawPage: function (data) {
            doc.setFontSize(8)
            let pageCount = doc.internal.getNumberOfPages()
            doc.text('Página ' + data.pageNumber + ' de ' + pageCount, data.settings.margin.left, doc.internal.pageSize.height - 10)
        }
    });

    doc.save(`Stock_ThorHerramientas_${new Date().toISOString().slice(0, 10)}.pdf`);
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-producto");
  const tbody = document.getElementById("tabla-productos-body");
  const inputBuscador = document.getElementById("buscador-admin");
  const btnDescargarPDF = document.getElementById("btn-descargar-stock-pdf"); 
  
  const btnRealizarVenta = document.getElementById('btn-realizar-venta');
  const inputCodBarraVenta = document.getElementById('venta-input-codbarra');
  const btnVaciarVenta = document.getElementById('btn-vaciar-venta');
  const btnConfirmarVenta = document.getElementById('btn-confirmar-venta');
  
  const inputDescuento = document.getElementById('venta-input-descuento');
  const btnApplyDiscount = document.getElementById('btn-aplicar-descuento');
  const btnQuitarDescuento = document.getElementById('btn-quitar-descuento');
  
  const btnShowProductos = document.getElementById('btn-show-productos');
  const btnShowHistorial = document.getElementById('btn-show-historial');
  
  const btnToggleFormulario = document.getElementById('btn-toggle-formulario');
  const cardFiltroAgotados = document.getElementById('btn-filtro-agotados');
  const alertaFiltro = document.getElementById('alerta-filtro-activo');
  const btnQuitarAlertaFiltro = document.getElementById('btn-quitar-filtro-agotados');

  cargarProductosDesdeFirestore().catch(err => {
    console.error("Error cargando productos:", err);
    alert("Hubo un problema cargando los productos.");
  });
  
  if (btnDescargarPDF) btnDescargarPDF.addEventListener("click", generarPDFStock);
  if (btnShowProductos) btnShowProductos.addEventListener('click', () => mostrarPanel('productos'));
  if (btnShowHistorial) btnShowHistorial.addEventListener('click', () => mostrarPanel('historial'));

  if (btnToggleFormulario) {
    btnToggleFormulario.addEventListener('click', () => toggleFormularioProducto());
  }

  const aplicarOQuitarFiltroAgotados = () => {
      soloAgotados = !soloAgotados;
      
      if (soloAgotados) {
          cardFiltroAgotados.classList.add('activo-filtro');
          alertaFiltro.classList.remove('oculto');
      } else {
          cardFiltroAgotados.classList.remove('activo-filtro');
          alertaFiltro.classList.add('oculto');
      }
      renderTablaProductos();
  };

  if (cardFiltroAgotados) cardFiltroAgotados.addEventListener('click', aplicarOQuitarFiltroAgotados);
  if (btnQuitarAlertaFiltro) btnQuitarAlertaFiltro.addEventListener('click', aplicarOQuitarFiltroAgotados);

  if (inputBuscador) {
    inputBuscador.addEventListener("input", () => {
      filtroTexto = inputBuscador.value.trim();
      renderTablaProductos();
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault(); 

    const id = document.getElementById("prod-id").value.trim();
    const nombre = document.getElementById("prod-nombre").value.trim();
    const sku = document.getElementById("prod-sku").value.trim(); 
    const marca = document.getElementById("prod-marca").value.trim();
    const costo = Number(document.getElementById("prod-costo").value || 0); 
    const precio = Number(document.getElementById("prod-precio").value || 0);
    const stock = Number(document.getElementById("prod-stock").value || 0);
    const alimentacion = document.getElementById("prod-alimentacion").value;
    const codbarra = document.getElementById("prod-codbarra").value.trim(); 
    const imagenTexto = document.getElementById("prod-imagen").value.trim();
    const description = document.getElementById("prod-descripcion").value.trim();
    const enviosText = document.getElementById("prod-envios").value;
    const detallesText = document.getElementById("prod-detalles").value;

    if (!nombre) {
      alert("El nombre es obligatorio.");
      return;
    }

    const opcionesEnvio = enviosText.split(",").map(t => t.trim()).filter(Boolean);
    const detalles = detallesText.split("\n").map(t => t.trim()).filter(Boolean);

    const images = imagenTexto ? imagenTexto.split(",").map(u => u.trim()).filter(Boolean) : [];
    const imagenPlaceholder = "https://via.placeholder.com/300x200?text=Producto";
    const imagenPrincipal = images.length > 0 ? images[0] : imagenPlaceholder;

    const producto = { nombre, sku, marca, costo, precio, stock, alimentacion, codbarra, imagen: imagenPrincipal, imagenes: images, descripcion: description, opcionesEnvio, detalles };

    try {
      if (id) {
        await productosRef.doc(id).update(producto);
        alert("Producto actualizado correctamente.");
      } else {
        await productosRef.add(producto);
        alert("Producto creado correctamente.");
      }
      toggleFormularioProducto(false);
      await cargarProductosDesdeFirestore(); 
    } catch (err) {
      console.error("Error guardando producto:", err);
      alert("Hubo un error guardando el producto.");
    }
  });

  tbody.addEventListener("change", async (e) => {
    if (e.target.classList.contains("costo-input-edit")) {
      const id = e.target.dataset.id;
      const nuevoValor = e.target.value;
      await actualizarCostoRapidoPorInput(id, nuevoValor);
    }
  });

  tbody.addEventListener("change", async (e) => {
    if (e.target.classList.contains("precio-input-edit")) {
      const id = e.target.dataset.id;
      const nuevoValor = e.target.value;
      await actualizarPrecioRapidoPorInput(id, nuevoValor);
    }
  });

  tbody.addEventListener("change", async (e) => {
    if (e.target.classList.contains("stock-input-edit")) {
      const id = e.target.dataset.id;
      const nuevoValor = e.target.value;
      await actualizarStockRapidoPorInput(id, nuevoValor);
    }
  });

  tbody.addEventListener("click", async (e) => {
    const accion = e.target.dataset.accion;
    const id = e.target.dataset.id;
    const delta = e.target.dataset.delta; 
    
    if (!id) return;

    if (e.target.classList.contains("btn-stock-quick")) {
        if (delta) await actualizarStockRapido(id, Number(delta));
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
        await cargarProductosDesdeFirestore(); 
        alert("Producto eliminado.");
      } catch (err) {
        console.error("Error de eliminación:", err);
        alert("No se pudo eliminar el producto.");
      }
    }
  });
  
  document.getElementById("btn-limpiar-form").addEventListener("click", () => limpiarFormulario());
});
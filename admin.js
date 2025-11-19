// Colección de Firestore
const productosRef = db.collection("productos");

let productos = []; 		// [{id, data}]
let filtroTexto = ""; 	  // texto del buscador
let ventaActual = [];   // [{id: string, cantidad: number, precio: number, nombre: string}] 

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

// CAMBIO CRÍTICO: Normalizamos la búsqueda de productos y soportamos múltiples códigos
function productosFiltrados() {
  if (!filtroTexto) return productos;
  const t = filtroTexto.toLowerCase();
  
  // Normalizamos el texto de búsqueda (quitamos no-alfanuméricos)
  const tNormalizado = filtroTexto.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  return productos.filter(p => {
    const d = p.data;
    
    // Búsqueda normal (nombre, marca, descripción)
    const textMatch = (d.nombre && d.nombre.toLowerCase().includes(t)) ||
                      (d.marca && d.marca.toLowerCase().includes(t)) ||
                      (d.descripcion && d.descripcion.toLowerCase().includes(t));

    // Búsqueda por código de barras (soporta múltiples códigos)
    const codigosGuardados = d.codbarra ? d.codbarra.split(',') : [];
    
    const codbarraMatch = codigosGuardados.some(cod => {
        const codbarraGuardadoNormalizado = cod.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        return codbarraGuardadoNormalizado.includes(tNormalizado);
    });
    
    return textMatch || codbarraMatch; // Coincide si alguna de las dos búsquedas coincide
  });
}
// FIN CAMBIO CRÍTICO

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
            <span id="stock-value-${p.id}" style="min-width: 20px;">${p.data.stock ?? "-"}</span>
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

// ---------------------- FUNCIONALIDAD DE STOCK RÁPIDO ----------------------

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
        
        // 3. Actualizar la UI localmente (tabla y estadísticas)
        const stockSpan = document.getElementById(`stock-value-${idProducto}`);
        if (stockSpan) stockSpan.textContent = nuevoStock;
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
    renderVentaPanel();
}

function abrirVenta() {
    const backdrop = document.getElementById('venta-backdrop');
    if (backdrop) {
        backdrop.style.display = 'flex'; 
        backdrop.classList.remove('oculto');
    }
    vaciarVenta(); // Asegurar que inicie limpia
    document.getElementById('venta-input-codbarra').focus();
}

function cerrarVenta() {
    const backdrop = document.getElementById('venta-backdrop');
    if (backdrop) {
        backdrop.style.display = 'none'; 
        backdrop.classList.add('oculto'); 
    }
    vaciarVenta();
    // Vuelve el foco al buscador del admin al cerrar el modal (mejora de UX)
    const buscadorAdmin = document.getElementById('buscador-admin');
    if (buscadorAdmin) buscadorAdmin.focus();
}

// CAMBIO CRÍTICO: Normalizamos la búsqueda en el punto de venta para soportar múltiples códigos
function agregarProductoAVenta(codbarra) {
    if (!codbarra) return;

    // Normalizamos el código de barras escaneado/ingresado
    const codbarraNormalizado = codbarra.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

    // 2. Buscar en el array de productos cargados localmente
    const productoEnStock = productos.find(p => {
        if (!p.data.codbarra) return false;

        // a. Dividir los códigos de barra guardados por coma
        const codigosGuardados = p.data.codbarra.split(',');

        // b. Verificar si alguno de los códigos guardados (normalizados) coincide con el escaneado (normalizado)
        return codigosGuardados.some(guardado => {
            const codbarraGuardadoNormalizado = guardado.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
            return codbarraGuardadoNormalizado === codbarraNormalizado;
        });
    });

    if (!productoEnStock) {
        alert(`Producto con código de barras "${codbarra}" no encontrado. Asegúrese de que el código esté correctamente cargado en el formulario de producto.`);
        return;
    }

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
// FIN CAMBIO CRÍTICO

function renderVentaPanel() {
    const listaDiv = document.getElementById('venta-items-list');
    const totalSpan = document.getElementById('venta-total-display');
    const btnConfirmar = document.getElementById('btn-confirmar-venta');
    let total = 0;

    listaDiv.innerHTML = '';

    if (ventaActual.length === 0) {
        listaDiv.innerHTML = '<p style="color:#777;">No hay productos en la venta.</p>';
        btnConfirmar.disabled = true;
    } else {
        ventaActual.forEach(item => {
            const subtotal = item.precio * item.cantidad;
            total += subtotal;
            
            const p = document.createElement('p');
            // Reemplazamos \u00A0 con espacio normal para el display dentro del modal.
            p.innerHTML = `
                <span style="font-weight:600;">${item.cantidad}x</span> 
                ${item.nombre} 
                <span style="float:right;">${formatearPrecio(subtotal).replace(/\u00A0/g, ' ')}</span>
            `;
            listaDiv.appendChild(p);
        });
        btnConfirmar.disabled = false;
    }

    // Reemplazamos \u00A0 con espacio normal para el display del total.
    totalSpan.textContent = formatearPrecio(total).replace(/\u00A0/g, ' ');
}


async function confirmarVenta() {
    if (ventaActual.length === 0) return;

    // Usamos una Transacción de Firestore para asegurar que la lectura del stock
    // y la actualización del nuevo stock sean atómicas (seguras).
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

                // 1. Actualizar el stock en la transacción
                transaction.update(docRef, { stock: nuevoStock });

                // 2. Preparar la actualización local para la UI (después de la transacción)
                updatesList.push({ id: item.id, nuevoStock: nuevoStock });
            }

            return updatesList; // Devolvemos las actualizaciones exitosas
        });

        // Si la transacción fue exitosa, actualizamos la UI y el estado local.
        updates.forEach(update => {
            const prodEntry = productos.find(p => p.id === update.id);
            if (prodEntry) prodEntry.data.stock = update.nuevoStock;
        });

        const totalVenta = ventaActual.reduce((t, i) => t + i.precio * i.cantidad, 0);
        alert(`Venta por ${formatearPrecio(totalVenta).replace(/\u00A0/g, ' ')} confirmada y stock actualizado!`);
        
        // Refrescar toda la interfaz del administrador
        vaciarVenta();
        renderTablaProductos();
        renderEstadisticas();
        // Cierra el panel y vuelve al admin principal
        cerrarVenta(); 

    } catch (error) {
        console.error("Error en la transacción de venta:", error);
        alert(`Error al confirmar la venta: ${error.message}`);
    }
}
// ---------------------------------------------------------------------------


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
  const btnLimpiar = document.getElementById("btn-limpiar-form");
  const tbody = document.getElementById("tabla-productos-body");
  const inputBuscador = document.getElementById("buscador-admin");
  const btnDescargarPDF = document.getElementById("btn-descargar-stock-pdf"); 
  
  // NUEVOS BOTONES DE VENTA
  const btnRealizarVenta = document.getElementById('btn-realizar-venta');
  const inputCodBarraVenta = document.getElementById('venta-input-codbarra');
  const btnVaciarVenta = document.getElementById('btn-vaciar-venta');
  const btnConfirmarVenta = document.getElementById('btn-confirmar-venta');
  
  // Cargar productos
  cargarProductosDesdeFirestore().catch(err => {
    console.error("Error cargando productos:", err);
    alert("Hubo un problema cargando los productos.");
  });
  
  // Asignar evento al botón de descarga de PDF
  if (btnDescargarPDF) {
      btnDescargarPDF.addEventListener("click", generarPDFStock);
  }

  // Buscar en vivo
  if (inputBuscador) {
    inputBuscador.addEventListener("input", () => {
      filtroTexto = inputBuscador.value.trim();
      renderTablaProductos();
    });
  }

  // ------------- LISTENERS VENTA RÁPIDA -------------
  if (btnRealizarVenta) btnRealizarVenta.addEventListener('click', abrirVenta);
  // NOTA: btnCerrarVenta usa onclick="cerrarVenta()" en el HTML.
  if (btnVaciarVenta) btnVaciarVenta.addEventListener('click', vaciarVenta);
  if (btnConfirmarVenta) btnConfirmarVenta.addEventListener('click', confirmarVenta);

  if (inputCodBarraVenta) {
      inputCodBarraVenta.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
              e.preventDefault();
              const codbarra = inputCodBarraVenta.value.trim();
              agregarProductoAVenta(codbarra);
              inputCodBarraVenta.value = ''; // Limpiar campo después de escanear/ingresar
          }
      });
      // Permite agregar si se pierde el foco (útil para escáneres que no envían Enter)
      inputCodBarraVenta.addEventListener('blur', () => {
          const codbarra = inputCodBarraVenta.value.trim();
          if (codbarra) {
              agregarProductoAVenta(codbarra);
              inputCodBarraVenta.value = ''; 
          }
      });
  }
  // ----------------------------------------------------


  // Guardar / actualizar
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
        await productosRef.doc(id).update(producto);
        alert("Producto actualizado correctamente.");
      } else {
        await productosRef.add(producto);
        alert("Producto creado correctamente.");
      }
      limpiarFormulario();
      await cargarProductosDesdeFirestore(); // actualiza lista + estadísticas
    } catch (err) {
      console.error("Error guardando producto:", err);
      alert("Hubo un error guardando el producto.");
    }
  });

  btnLimpiar.addEventListener("click", () => limpiarFormulario());

  // Escucha los clics en la tabla para EDITAR/ELIMINAR/STOCK RÁPIDO
  tbody.addEventListener("click", async (e) => {
    const accion = e.target.dataset.accion;
    const id = e.target.dataset.id;
    const delta = e.target.dataset.delta; // Para los botones de stock
    
    if (!id) return;

    if (e.target.classList.contains("btn-stock-quick")) {
        // Lógica de STOCK RÁPIDO
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
});
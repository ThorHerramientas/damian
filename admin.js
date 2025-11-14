// Colección de Firestore
const productosRef = db.collection("productos");

let productos = []; 		// [{id, data}]
let filtroTexto = ""; 	  // texto del buscador

function formatearPrecio(numero) {
  return (Number(numero) || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0
  });
}

function limpiarFormulario() {
  document.getElementById("prod-id").value = "";
  document.getElementById("prod-nombre").value = "";
  document.getElementById("prod-marca").value = "";
  document.getElementById("prod-precio").value = "";
  document.getElementById("prod-stock").value = "";
  document.getElementById("prod-categoria").value = "";
  // INICIO DEL CAMBIO
  document.getElementById("prod-alimentacion").value = "Otro"; // Valor por defecto
  // FIN DEL CAMBIO
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
  document.getElementById("prod-categoria").value = prod.categoria || "";
  // INICIO DEL CAMBIO
  document.getElementById("prod-alimentacion").value = prod.alimentacion || "Otro";
  // FIN DEL CAMBIO
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
  const t = filtroTexto.toLowerCase();
  return productos.filter(p => {
    const d = p.data;
    return (
      (d.nombre && d.nombre.toLowerCase().includes(t)) ||
      (d.marca && d.marca.toLowerCase().includes(t)) ||
      (d.descripcion && d.descripcion.toLowerCase().includes(t))
    );
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
      <td>${p.data.stock ?? "-"}</td>
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
  renderEstadisticas(); 	// <-- actualiza estadísticas
  renderTablaProductos(); 	// <-- lista
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-producto");
  const btnLimpiar = document.getElementById("btn-limpiar-form");
  const tbody = document.getElementById("tabla-productos-body");
  const inputBuscador = document.getElementById("buscador-admin");

  // Cargar productos
  cargarProductosDesdeFirestore().catch(err => {
    console.error("Error cargando productos:", err);
    alert("Hubo un problema cargando los productos.");
  });

  // Buscar en vivo
  if (inputBuscador) {
    inputBuscador.addEventListener("input", () => {
      filtroTexto = inputBuscador.value.trim();
      renderTablaProductos();
    });
  }

  // Guardar / actualizar
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("prod-id").value.trim();
    const nombre = document.getElementById("prod-nombre").value.trim();
    const marca = document.getElementById("prod-marca").value.trim();
    const precio = Number(document.getElementById("prod-precio").value || 0);
    const stock = Number(document.getElementById("prod-stock").value || 0);
    const categoria = document.getElementById("prod-categoria").value.trim();
    // INICIO DEL CAMBIO
    const alimentacion = document.getElementById("prod-alimentacion").value;
    // FIN DEL CAMBIO
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
      categoria,
      // INICIO DEL CAMBIO
      alimentacion, // Guardamos el string
      // FIN DEL CAMBIO
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

  // Editar / eliminar
  tbody.addEventListener("click", async (e) => {
    const accion = e.target.dataset.accion;
    const id = e.target.dataset.id;
    if (!accion || !id) return;

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
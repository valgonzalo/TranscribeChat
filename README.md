# 🎙️ VoiceChat Studio

Estudio minimalista de notas de voz en tiempo real con reconocimiento neuronal en **Español (Argentina)**, visualizador de audio reactivo a 60 FPS y exportación individual o en bloque (`.TXT`, `.MD`, `.JSON`).

---

## 🚀 Despliegue en Vercel

El proyecto está 100% preparado y optimizado con `vercel.json` configurado (políticas de micrófono HTTPS, cabeceras de seguridad y URLs limpias).

### Opción 1: Despliegue con Vercel CLI (Recomendado)
1. Instalar Vercel CLI si no lo tenés:
   ```bash
   npm i -g vercel
   ```
2. Ejecutar dentro de esta carpeta:
   ```bash
   vercel
   ```
3. Para pasar a producción:
   ```bash
   vercel --prod
   ```

---

### Opción 2: Despliegue desde GitHub
1. Subí este repositorio a tu GitHub:
   ```bash
   git add .
   git commit -m "feat: VoiceChat Studio Vercel Ready"
   git push origin main
   ```
2. Ingresá a [vercel.com](https://vercel.com) y hacé clic en **"Add New Project"**.
3. Seleccioná este repositorio y dale a **"Deploy"** (Vercel lo detecta automáticamente como sitio estático sin necesidad de configurar build command).

---

## ✨ Características Principales
- 🧠 **Web Speech API Nativa:** Reconocimiento de voz continuo sin APIs pagas de terceros.
- 🌊 **Audio Equalizer 60 FPS:** Visualizador reactivo que responde a la intensidad de tu voz.
- 📄 **Exportación por Nota:** Menú de 3 puntitos (`⋮`) en cada tarjeta para descargar en `.TXT`, `.MD` o `.JSON`.
- 💾 **Persistencia Local:** Tus notas quedan guardadas en tu navegador automáticamente.
- 📱 **Diseño Ultra-Responsive:** Adaptado fluidamente desde 320px hasta pantallas 4K.

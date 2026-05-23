#!/bin/bash

# ##############################################################################
#
# Bee Agent for Scaffold - Resource Setup Script (v6)
#
# Este script configura los recursos necesarios (build.json, release.json y 
# el repositorio de código) para el proyecto dentro de la carpeta ./resources
#
#
# ##############################################################################

# Función para registrar un mensaje en consola
log() {
  echo "[SETUP] $1"
}

# La ejecución se realiza dentro del directorio del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR" || exit 1

# Definir directorio de recursos
RESOURCES_DIR="resources"

# Crear el directorio de recursos si no existe
if [ ! -d "$RESOURCES_DIR" ]; then
  mkdir -p "$RESOURCES_DIR"
fi

log "========================================"
log "Bee Agent for Scaffold - Resource Setup"
log "========================================"

# --- 1. Determinar Host IP desde WSL ---
log "Detectando IP del host desde WSL..."
HOST_IP="localhost"
if [ -z "$HOST_IP" ]; then
  log "✗ No se pudo determinar la IP del host. Se usará 'localhost'."
  HOST_IP="localhost"
else
  log "✓ IP del host detectada: $HOST_IP"
fi
echo ""

# --- 2. Recopilar toda la información del usuario ---
log "Por favor, proporciona la siguiente información."
log "Si dejas un campo en blanco, se creará un recurso vacío (placeholder)."
echo ""

# Nuevo orden: Repositorio, Build ID, Release ID
read -p "Introduce el Nombre del Repositorio (para clonar): " repo_name
read -p "Introduce el Build ID (idDelBuild): " build_id
read -p "Introduce el Release ID (idDelRelease): " release_id
echo ""

log "========================================"
log "Procesando... Los archivos se guardarán en './$RESOURCES_DIR'"
log "========================================"
echo ""

# --- 3. Ejecutar acciones ---

# Acción para Repositorio
log "Procesando Repositorio..."
REPO_PATH="$RESOURCES_DIR/repo"

if [ -z "$repo_name" ]; then
  log "Nombre de Repositorio no proporcionado. Creando directorio '$REPO_PATH' vacío."
  rm -rf "$REPO_PATH"
  mkdir -p "$REPO_PATH"
else
  if [ -d "$REPO_PATH" ]; then
    log "Eliminando directorio '$REPO_PATH' existente..."
    rm -rf "$REPO_PATH"
  fi

  repo_url="https://grupobancolombia.visualstudio.com/Vicepresidencia%20Servicios%20de%20Tecnolog%C3%ADa/_git/$repo_name"
  log "Clonando repositorio: $repo_name en $REPO_PATH..."
  
  if git clone "$repo_url" "$REPO_PATH"; then
    log "✓ Repositorio clonado exitosamente en '$REPO_PATH'."
  else
    log "✗ Error al clonar el repositorio (código de salida: $?). Se creará un directorio vacío como fallback."
    rm -rf "$REPO_PATH"
    mkdir -p "$REPO_PATH"
  fi
fi
echo ""

# Acción para Build
log "Procesando Build..."
BUILD_FILE="$RESOURCES_DIR/build.json"

if [ -z "$build_id" ]; then
  log "Build ID no proporcionado. Creando '$BUILD_FILE' vacío."
  echo "{}" > "$BUILD_FILE"
else
  BUILD_URL="http://$HOST_IP:4020/api/azure/build/$build_id"
  log "Obteniendo información del build desde: $BUILD_URL"

  raw_output=$(curl -s --request GET --url "$BUILD_URL")
  curl_exit_code=$?

  if [ $curl_exit_code -eq 0 ]; then
    if command -v jq &> /dev/null; then
      formatted_output=$(echo "$raw_output" | jq '.')
      if [ $? -eq 0 ]; then
        echo "$formatted_output" > "$BUILD_FILE"
        log "✓ '$BUILD_FILE' creado y formateado exitosamente."
      else
        echo "$raw_output" > "$BUILD_FILE"
        log "⚠️  Warning: La respuesta no es JSON válido. Guardado sin formato en '$BUILD_FILE'."
      fi
    else
      echo "$raw_output" > "$BUILD_FILE"
      log "✓ '$BUILD_FILE' creado. (Instala 'jq' para formatear automáticamente)."
    fi
  else
    log "✗ Error al obtener información del build (cURL code: $curl_exit_code)."
    log "  Se creará un archivo vacío como fallback."
    echo "{}" > "$BUILD_FILE"
  fi
fi
echo ""

# Acción para Release
log "Procesando Release..."
RELEASE_FILE="$RESOURCES_DIR/release.json"

if [ -z "$release_id" ]; then
  log "Release ID no proporcionado. Creando '$RELEASE_FILE' vacío."
  echo "{}" > "$RELEASE_FILE"
else
  RELEASE_URL="http://$HOST_IP:4020/api/azure/release/$release_id"
  log "Obteniendo información del release desde: $RELEASE_URL"

  raw_output=$(curl -s --request GET --url "$RELEASE_URL")
  curl_exit_code=$?

  if [ $curl_exit_code -eq 0 ]; then
    if command -v jq &> /dev/null; then
      formatted_output=$(echo "$raw_output" | jq '.')
      if [ $? -eq 0 ]; then
        echo "$formatted_output" > "$RELEASE_FILE"
        log "✓ '$RELEASE_FILE' creado y formateado exitosamente."
      else
        echo "$raw_output" > "$RELEASE_FILE"
        log "⚠️  Warning: La respuesta no es JSON válido. Guardado sin formato en '$RELEASE_FILE'."
      fi
    else
      echo "$raw_output" > "$RELEASE_FILE"
      log "✓ '$RELEASE_FILE' creado. (Instala 'jq' para formatear automáticamente)."
    fi
  else
    log "✗ Error al obtener información del release (cURL code: $curl_exit_code)."
    log "  Se creará un archivo vacío como fallback."
    echo "{}" > "$RELEASE_FILE"
  fi
fi
echo ""

log "========================================"
log "Configuración de recursos completada en ./$RESOURCES_DIR"
log "========================================"
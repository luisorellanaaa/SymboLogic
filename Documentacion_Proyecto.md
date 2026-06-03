# Documentación Técnica y Académica: SymboLogic

**Proyecto Final: Aplicación Gamificada de Lógica Simbólica y Teoría de Conjuntos**
**Modalidad:** Luis Orellana 31337432, Angel Torres 32084739


---

## 1. Introducción y Justificación
**SymboLogic** es una aplicación de escritorio diseñada con el propósito de facilitar el aprendizaje de dos áreas fundamentales de las matemáticas discretas: **Teoría de Conjuntos** y **Lógica Proposicional**. 

El proyecto nace de la necesidad de modernizar la enseñanza académica, pasando de cuestionarios estáticos en papel a una **experiencia interactiva, gamificada y de alta retención**. Al implementar un sistema de puntuaciones con tiempo límite y retroalimentación inmediata, se estimula la agilidad mental del estudiante.

---

## 2. Arquitectura del Sistema
Para asegurar que la aplicación pueda ser ejecutada en cualquier computadora de la universidad sin requerir instalaciones previas de servidores, internet o bases de datos complejas, se optó por una arquitectura **100% Offline, Local y Portable**.

### 2.1. Tecnologías Utilizadas
* **Backend y Empaquetado (Python):** Se utilizó el lenguaje Python junto con la librería `pywebview` para crear una ventana nativa de escritorio independiente del navegador del usuario. El proyecto fue compilado en un único archivo `.exe` usando `PyInstaller`.
* **Capa de Persistencia de Datos (JSON + Python API):** En lugar de depender de motores SQL pesados o cachés volátiles de navegador, desarrollamos una API en Python que lee y escribe directamente sobre un archivo local (`game_data.json`). Esto garantiza que los usuarios y puntajes sobrevivan a reinicios del sistema.
* **Frontend (Vanilla HTML5, CSS3, JavaScript ES6):** Se programó toda la interfaz y la lógica del juego desde cero sin frameworks pesados, asegurando tiempos de carga de milisegundos y máximo rendimiento.

---

## 3. Características y Funcionalidades Principales

### 3.1. Diseño Minimalista y UX Moderno
Se descartaron las interfaces anticuadas en favor de un diseño basado en **Glassmorphism** (paneles de cristal translúcido), esquema de colores monocromáticos (escala de negros y grises) e inicio maximizado, ofreciendo un estándar de interfaz de usuario de nivel profesional y vanguardista.

### 3.2. Sistema de Roles de Usuario
La aplicación cuenta con un sistema de registro y un **usuario Administrador** predeterminado (`admin` / `admin123`).
* **Jugadores:** Pueden participar en las pruebas y guardar sus puntajes.
* **Administrador:** Tiene acceso garantizado de fábrica y sienta las bases para futuras implementaciones de edición de preguntas.

### 3.3. Algoritmo Anti-Repetición
Para garantizar que las evaluaciones sean justas y variadas, se programó un banco de preguntas extenso y un algoritmo de aleatoriedad condicionada (Bucle `do-while`). El sistema rastrea en memoria RAM el identificador de la pregunta anterior y **garantiza matemáticamente** que ninguna pregunta aparecerá dos veces de forma consecutiva.

### 3.4. Tabla de Clasificación Dinámica (Leaderboard)
Las puntuaciones se separan y ordenan lógicamente según la rama matemática evaluada:
1. Top 3 Global en Teoría de Conjuntos.
2. Top 3 Global en Lógica Proposicional.
El motor lee el archivo de guardado en tiempo real, filtra por categoría, ordena por puntaje y renderiza los resultados.

---

## 4. Contenido Educativo Evaluado

### Teoría de Conjuntos
Se evalúa la comprensión de operaciones básicas e intermedias, tales como:
* Unión (`∪`), Intersección (`∩`), Diferencia (`-`), y Diferencia Simétrica (`△`).
* Conceptos de Conjunto Vacío (`Ø`), Conjunto Universal (`U`) y Subconjuntos (`⊆`).
* Leyes del álgebra de conjuntos (ej. Idempotencia, Leyes de De Morgan).

### Lógica Proposicional
Las preguntas superan el simple "Verdadero o Falso", evaluando entendimiento teórico:
* **Conectivos:** Conjunción (`∧`), Disyunción (`∨`), Implicación (`→`), Bicondicional (`↔`).
* **Propiedades:** Tautologías, Contradicciones y Contingencias.
* **Reglas de Inferencia:** Modus Ponens, Modus Tollens y Silogismos.

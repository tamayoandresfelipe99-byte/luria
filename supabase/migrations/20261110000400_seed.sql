-- ═══════════════════════════════════════════════════════════════════
-- LURIA · Migración 0004 · Datos de referencia (NO son datos de clientes)
-- ═══════════════════════════════════════════════════════════════════

insert into public.products (sku, name, price_cop) values
  ('luria-mensual', 'LURIA — suscripción mensual', 40000);

-- Seis módulos declarados por el fabricante. Estado inicial: declarada (sin validación técnica).
insert into public.features (id, position, name, description, benefit) values
  ('vigia-calificacion', 1, 'Vigía de calificación', 'Consulta evidencias y entregas de la ficha en una sola vista.', 'Más control y menos tiempo de revisión.'),
  ('paquete-evidencias', 2, 'Paquete de evidencias para certificación', 'Reúne las evidencias de un aprendiz en un solo proceso.', 'Documentación organizada de manera más eficiente.'),
  ('matriz-evidencias', 3, 'Informe de matriz de evidencias', 'Genera una matriz de aprendices y evidencias de la ficha.', 'Seguimiento académico centralizado.'),
  ('gestor-fechas', 4, 'Gestor de fechas', 'Organiza fechas de apertura, cierre y calificación.', 'Organización del cronograma y reducción de tareas repetitivas.'),
  ('juicios-evaluativos', 5, 'Juicios evaluativos', 'Analiza el reporte oficial de la ficha.', 'Información organizada para seguimiento y toma de decisiones.'),
  ('reenvios', 6, 'Reenvíos', 'Identifica evidencias que requieren reenvío.', 'Mayor control del proceso de recuperación académica.');

-- Entorno de referencia, sin verificar. Se marca 'verificado' solo con evidencia y fecha de prueba.
insert into public.environments (platform, browser, compatibility_status)
values ('ZAJUNA', 'Google Chrome (escritorio)', 'en_prueba');

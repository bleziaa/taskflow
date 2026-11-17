-- Estados de auditoría para entregas retiradas o sustituidas por el estudiante.
ALTER TABLE academic_course_evidences
  MODIFY COLUMN status ENUM('pendiente','aprobada','reprobada','requiere_cambios','retirada','reemplazada') NOT NULL DEFAULT 'pendiente';

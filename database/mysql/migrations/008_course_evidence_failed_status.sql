ALTER TABLE academic_course_evidences
  MODIFY COLUMN status ENUM('pendiente','aprobada','reprobada','requiere_cambios') NOT NULL DEFAULT 'pendiente';

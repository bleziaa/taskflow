-- Espacios de trabajo por curso. Los usuarios y organizaciones siguen siendo maestros en MongoDB.
CREATE TABLE IF NOT EXISTS academic_courses (
  id CHAR(24) NOT NULL,
  organization_id CHAR(24) NOT NULL,
  course_code VARCHAR(40) NOT NULL,
  name VARCHAR(140) NOT NULL,
  description TEXT NULL,
  status ENUM('activo','inactivo','archivado') NOT NULL DEFAULT 'activo',
  created_by_user_id CHAR(24) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_courses_org_code (organization_id, course_code),
  UNIQUE KEY uq_courses_org_id (organization_id, id),
  KEY idx_courses_org_status (organization_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_course_teachers (
  id CHAR(24) NOT NULL,
  organization_id CHAR(24) NOT NULL,
  course_id CHAR(24) NOT NULL,
  teacher_user_id CHAR(24) NOT NULL,
  assigned_by_user_id CHAR(24) NOT NULL,
  status ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_teacher (organization_id, course_id, teacher_user_id),
  KEY idx_course_teachers_user (organization_id, teacher_user_id, status),
  CONSTRAINT fk_course_teachers_course FOREIGN KEY (organization_id, course_id)
    REFERENCES academic_courses (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_course_students (
  id CHAR(24) NOT NULL,
  organization_id CHAR(24) NOT NULL,
  course_id CHAR(24) NOT NULL,
  student_id CHAR(24) NOT NULL,
  status ENUM('activo','inactivo','retirado') NOT NULL DEFAULT 'activo',
  enrolled_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_student (organization_id, course_id, student_id),
  KEY idx_course_students_student (organization_id, student_id, status),
  CONSTRAINT fk_course_students_course FOREIGN KEY (organization_id, course_id)
    REFERENCES academic_courses (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_course_students_student FOREIGN KEY (organization_id, student_id)
    REFERENCES academic_students (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_course_resources (
  id CHAR(24) NOT NULL,
  organization_id CHAR(24) NOT NULL,
  course_id CHAR(24) NOT NULL,
  title VARCHAR(160) NOT NULL,
  description VARCHAR(1000) NOT NULL DEFAULT '',
  original_name VARCHAR(180) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size_bytes INT UNSIGNED NOT NULL,
  uploaded_by_user_id CHAR(24) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_resource_stored_name (stored_name),
  KEY idx_course_resources_course_date (organization_id, course_id, created_at),
  CONSTRAINT fk_course_resources_course FOREIGN KEY (organization_id, course_id)
    REFERENCES academic_courses (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_course_resource_size CHECK (file_size_bytes BETWEEN 1 AND 26214400)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_course_activities (
  id CHAR(24) NOT NULL,
  organization_id CHAR(24) NOT NULL,
  course_id CHAR(24) NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NULL,
  instructions TEXT NULL,
  opens_at DATETIME(3) NULL,
  due_at DATETIME(3) NULL,
  status ENUM('borrador','publicada','cerrada','archivada') NOT NULL DEFAULT 'borrador',
  created_by_user_id CHAR(24) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_activity_org_id (organization_id, id),
  KEY idx_course_activities_course_due (organization_id, course_id, due_at),
  CONSTRAINT fk_course_activities_course FOREIGN KEY (organization_id, course_id)
    REFERENCES academic_courses (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_course_activity_dates CHECK (opens_at IS NULL OR due_at IS NULL OR due_at >= opens_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_course_evidences (
  id CHAR(24) NOT NULL,
  organization_id CHAR(24) NOT NULL,
  activity_id CHAR(24) NOT NULL,
  student_id CHAR(24) NOT NULL,
  original_name VARCHAR(180) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size_bytes INT UNSIGNED NOT NULL,
  status ENUM('pendiente','aprobada','requiere_cambios') NOT NULL DEFAULT 'pendiente',
  teacher_feedback TEXT NULL,
  reviewed_by_user_id CHAR(24) NULL,
  reviewed_at DATETIME(3) NULL,
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_evidence_stored_name (stored_name),
  KEY idx_course_evidences_activity (organization_id, activity_id, submitted_at),
  KEY idx_course_evidences_student (organization_id, student_id, status),
  CONSTRAINT fk_course_evidences_activity FOREIGN KEY (organization_id, activity_id)
    REFERENCES academic_course_activities (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_course_evidences_student FOREIGN KEY (organization_id, student_id)
    REFERENCES academic_students (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_course_evidence_size CHECK (file_size_bytes BETWEEN 1 AND 10485760)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_course_evaluations (
  id CHAR(24) NOT NULL,
  organization_id CHAR(24) NOT NULL,
  course_id CHAR(24) NOT NULL,
  student_id CHAR(24) NOT NULL,
  activity_id CHAR(24) NULL,
  teacher_user_id CHAR(24) NOT NULL,
  title VARCHAR(160) NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  max_score DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  feedback TEXT NULL,
  evaluated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_course_evaluations_course_student (organization_id, course_id, student_id, evaluated_at),
  CONSTRAINT fk_course_evaluations_course FOREIGN KEY (organization_id, course_id)
    REFERENCES academic_courses (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_course_evaluations_student FOREIGN KEY (organization_id, student_id)
    REFERENCES academic_students (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_course_evaluations_activity FOREIGN KEY (organization_id, activity_id)
    REFERENCES academic_course_activities (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_course_evaluation_score CHECK (max_score > 0 AND score >= 0 AND score <= max_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

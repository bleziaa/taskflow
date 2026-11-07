CREATE TABLE IF NOT EXISTS academic_course_activity_resources (
  id CHAR(24) NOT NULL,
  organization_id CHAR(24) NOT NULL,
  course_id CHAR(24) NOT NULL,
  activity_id CHAR(24) NOT NULL,
  title VARCHAR(160) NOT NULL,
  description VARCHAR(1000) NOT NULL DEFAULT '',
  original_name VARCHAR(180) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size_bytes INT UNSIGNED NOT NULL,
  uploaded_by_user_id CHAR(24) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_activity_resource_stored_name (stored_name),
  KEY idx_course_activity_resources_activity (organization_id, course_id, activity_id, created_at),
  CONSTRAINT fk_course_activity_resources_course FOREIGN KEY (organization_id, course_id)
    REFERENCES academic_courses (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_course_activity_resources_activity FOREIGN KEY (organization_id, activity_id)
    REFERENCES academic_course_activities (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_course_activity_resource_size CHECK (file_size_bytes BETWEEN 1 AND 10485760)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

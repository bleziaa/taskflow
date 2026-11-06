function mapCompany(row) {
  if (!row) return null;
  return {
    _id: row.id,
    organizationId: row.organization_id,
    razonSocial: row.legal_name,
    nit: row.tax_id,
    sector: row.sector,
    direccion: row.address,
    ciudad: row.city,
    contactoNombre: row.contact_name,
    contactoEmail: row.contact_email,
    telefono: row.phone,
    estado: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStudent(row, company = null) {
  if (!row) return null;
  return {
    _id: row.id,
    organizationId: row.organization_id,
    codigo: row.student_code,
    nombre: row.full_name,
    email: row.email,
    telefono: row.phone,
    programa: row.program,
    semestre: Number(row.semester),
    estado: row.status,
    usuario: row.user_id,
    empresa: company ? mapCompany(company) : (row.company_id || null),
    tutor: row.tutor_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = { mapCompany, mapStudent };

const ROLE_PRIORITY = ['member', 'manager', 'security', 'admin'];

const CLASSIFICATION_MATRIX = {
  public: {
    label: 'Открытый',
    minRole: 'member',
    description: 'Данные, доступные всем авторизованным пользователям.'
  },
  internal: {
    label: 'Внутренний',
    minRole: 'manager',
    description: 'Информация для руководителей и службы безопасности.'
  },
  confidential: {
    label: 'Конфиденциальный',
    minRole: 'security',
    description: 'Чувствительные данные, требующие двухфакторной аутентификации.'
  },
  topsecret: {
    label: 'Строго секретно',
    minRole: 'admin',
    description: 'Материалы высшего уровня, только для администраторов.'
  }
};

function roleRank(role) {
  const index = ROLE_PRIORITY.indexOf(role);
  return index === -1 ? 0 : index;
}

function canAccessClassification(role, classification) {
  const meta = CLASSIFICATION_MATRIX[classification] || CLASSIFICATION_MATRIX.public;
  return roleRank(role) >= roleRank(meta.minRole);
}

function getAvailableClassificationsForRole(role) {
  return Object.entries(CLASSIFICATION_MATRIX)
    .filter(([, meta]) => roleRank(role) >= roleRank(meta.minRole))
    .map(([value, meta]) => ({ value, ...meta }));
}

module.exports = {
  ROLE_PRIORITY,
  CLASSIFICATION_MATRIX,
  canAccessClassification,
  getAvailableClassificationsForRole
};

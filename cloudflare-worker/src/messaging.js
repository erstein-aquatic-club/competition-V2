export const buildMessageTargetUserIds = ({ targets = [], groupMembersById = new Map(), senderId }) => {
  const resolved = new Set();
  const addId = (value) => {
    const id = Number(value);
    if (Number.isFinite(id) && id > 0) {
      resolved.add(id);
    }
  };

  targets.forEach((target) => {
    addId(target?.target_user_id);
    const groupId = Number(target?.target_group_id);
    if (Number.isFinite(groupId) && groupId > 0) {
      const members = groupMembersById.get(groupId) || [];
      members.forEach(addId);
    }
  });

  addId(senderId);

  return Array.from(resolved);
};

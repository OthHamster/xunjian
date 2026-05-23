function TaskExecution({ task }) {
  if (!task) {
    return null;
  }

  return (
    <section style={{ marginTop: 16 }}>
      <h3>任务执行</h3>
      <div>任务ID: {task.taskId}</div>
      <div>路线ID: {task.routeId}</div>
      <div>分配时间: {task.assignedAt}</div>
      <div style={{ marginTop: 8 }}>
        <strong>下一个打卡点</strong>
      </div>
      {task.currentCheckpoint ? (
        <div>
          <div>名称: {task.currentCheckpoint.name}</div>
          <div>序号: {task.currentCheckpoint.seqNo}</div>
          <div>
            坐标: {task.currentCheckpoint.longitude},
            {task.currentCheckpoint.latitude}
          </div>
        </div>
      ) : (
        <div>暂无打卡点信息</div>
      )}
    </section>
  );
}

export default TaskExecution;

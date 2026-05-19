/**
 * 简单的路径管理器（前端使用）
 * - 管理单条路径（坐标数组）
 * - 支持设置节点指针并在指针后插入坐标
 * - 支持读取当前路径数据（返回浅拷贝）
 */

class PathManager {
  constructor() {
    /** @type {Array<[number, number]>} */
    this.path = [];
    /** @type {number} 当前节点指针索引，-1 表示未设置 */
    this.editIndex = -1;
  }

  /**
   * 设置当前路径数据（会重置指针）
   * @param {Array<[number, number]>} path
   */
  setPath(path) {
    if (!Array.isArray(path)) {
      throw new Error("path 必须为坐标数组");
    }
    this.path = path.map((coord) => [Number(coord[0]), Number(coord[1])]);
    this.editIndex = -1;
  }

  /**
   * 设置当前节点指针索引
   * @param {number} index
   */
  setEditIndex(index) {
    if (!Number.isInteger(index) || index < -1) {
      throw new Error("editIndex 越界");
    }
    if (index >= 0 && index >= this.path.length) {
      throw new Error("editIndex 越界");
    }
    this.editIndex = index;
  }

  /**
   * 获取当前节点指针索引
   * @returns {number}
   */
  getEditIndex() {
    return this.editIndex;
  }

  /**
   * 获取当前编辑路径的坐标数组（浅拷贝）
   * @returns {Array<[number, number]>}
   */
  getCurrentPath() {
    return this.path.slice();
  }

  /**
   * 删除当前编辑路径中指定索引的坐标
   * @param {number} index
   */
  removeCoordinateAt(index) {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error("坐标索引不合法");
    }
    if (index >= this.path.length) {
      throw new Error("坐标索引超出范围");
    }
    this.path.splice(index, 1);
    if (this.editIndex >= index) {
      this.editIndex = Math.max(this.editIndex - 1, -1);
    }
  }

  /**
   * 将坐标插入到当前指针的下一个节点
   * @param {[number, number]} coord - 坐标对 [longitude, latitude]
   */
  insertCoordinateAfterEditIndex(coord) {
    if (!Array.isArray(coord) || coord.length < 2) {
      throw new Error("coord 必须为 [lon, lat] 的数组");
    }

    if (!Number.isInteger(this.editIndex) || this.editIndex < -1) {
      throw new Error("插入指针不合法");
    }
    if (this.editIndex >= this.path.length) {
      throw new Error("插入指针超出范围");
    }

    const lon = Number(coord[0]);
    const lat = Number(coord[1]);

    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      throw new Error("坐标必须是有效的数字");
    }

    const insertIndex = this.editIndex + 1;
    this.path.splice(insertIndex, 0, [lon, lat]);
    this.editIndex = insertIndex;
  }

  /**
   * 清空所有路径并重置编辑索引
   */
  clear() {
    this.path = [];
    this.editIndex = -1;
  }
}

export default PathManager;

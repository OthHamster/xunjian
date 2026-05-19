/**
 * 简单的路径管理器（前端使用）
 * - 管理多条路径（每条为坐标数组）
 * - 支持创建新空路径并切换到该路径的编辑索引
 * - 支持向当前编辑路径写入坐标点
 * - 支持读取当前所有路径数据（返回浅拷贝）
 */

class PathManager {
  constructor() {
    /** @type {Array<Array<[number, number]>>} */
    this.paths = [];
    /** @type {number} 当前正在编辑的路径索引，-1 表示未选择 */
    this.editIndex = -1;
  }

  /**
   * 创建一条新的空路径，并将编辑索引设置为新路径的索引
   * @returns {number} 新创建路径的索引
   */
  createNewPath() {
    this.paths.push([]);
    this.editIndex = this.paths.length - 1;
    return this.editIndex;
  }

  /**
   * 将一个坐标写入到当前编辑索引对应的路径
   * 如果未选择编辑索引则抛出错误
   * @param {[number, number]} coord - 坐标对 [longitude, latitude]
   * @returns {void}
   */
  writeCoordinate(coord) {
    if (!Array.isArray(coord) || coord.length < 2) {
      throw new Error("coord 必须为 [lon, lat] 的数组");
    }

    if (this.editIndex < 0 || this.editIndex >= this.paths.length) {
      throw new Error(
        "未选择有效的编辑索引，请先调用 createNewPath() 或 setEditIndex()",
      );
    }

    const lon = Number(coord[0]);
    const lat = Number(coord[1]);

    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      throw new Error("坐标必须是有效的数字");
    }

    this.paths[this.editIndex].push([lon, lat]);
  }

  /**
   * 设置当前编辑索引
   * @param {number} index
   */
  setEditIndex(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.paths.length) {
      throw new Error("editIndex 越界");
    }
    this.editIndex = index;
  }

  /**
   * 获取当前编辑索引
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
    if (this.editIndex < 0 || this.editIndex >= this.paths.length) {
      return [];
    }
    return this.paths[this.editIndex].slice();
  }

  /**
   * 删除当前编辑路径中指定索引的坐标
   * @param {number} index
   */
  removeCoordinateAt(index) {
    if (this.editIndex < 0 || this.editIndex >= this.paths.length) {
      throw new Error("未选择有效的编辑索引");
    }
    if (!Number.isInteger(index) || index < 0) {
      throw new Error("坐标索引不合法");
    }
    const path = this.paths[this.editIndex];
    if (index >= path.length) {
      throw new Error("坐标索引超出范围");
    }
    path.splice(index, 1);
  }

  /**
   * 获取所有路径数据的浅拷贝（防止外部直接修改内部数组）
   * @returns {Array<Array<[number, number]>>}
   */
  getPaths() {
    return this.paths.map((p) => p.slice());
  }

  /**
   * 清空所有路径并重置编辑索引
   */
  clear() {
    this.paths = [];
    this.editIndex = -1;
  }
}

export default PathManager;

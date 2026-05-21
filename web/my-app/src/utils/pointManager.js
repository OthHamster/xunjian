/**
 * 简单的打卡点管理器（前端使用）
 * - 管理打卡点列表（包含坐标与名称）
 * - 支持设置当前指针并在指针后插入
 * - 支持读取当前打卡点数据（返回浅拷贝）
 */

class PointManager {
  constructor() {
    /** @type {Array<{ name: string, longitude: number, latitude: number }>} */
    this.points = [];
    /** @type {number} 当前指针索引，-1 表示未设置 */
    this.editIndex = -1;
  }

  /**
   * 设置当前打卡点数据（会重置指针）
   * @param {Array<{ name?: string, longitude: number, latitude: number }>} points
   */
  setPoints(points) {
    if (!Array.isArray(points)) {
      throw new Error("points 必须为数组");
    }

    this.points = points.map((point, index) => {
      const longitude = Number(point?.longitude ?? point?.lng ?? point?.lon);
      const latitude = Number(point?.latitude ?? point?.lat);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        throw new Error("打卡点经纬度不合法");
      }
      return {
        name: String(point?.name || `Checkpoint ${index + 1}`),
        longitude,
        latitude,
      };
    });
    this.editIndex = -1;
  }

  /**
   * 设置当前指针索引
   * @param {number} index
   */
  setEditIndex(index) {
    if (!Number.isInteger(index) || index < -1) {
      throw new Error("editIndex 越界");
    }
    if (index >= 0 && index >= this.points.length) {
      throw new Error("editIndex 越界");
    }
    this.editIndex = index;
  }

  /**
   * 获取当前指针索引
   * @returns {number}
   */
  getEditIndex() {
    return this.editIndex;
  }

  /**
   * 获取当前打卡点数组（浅拷贝）
   * @returns {Array<{ name: string, longitude: number, latitude: number }>}
   */
  getCurrentPoints() {
    return this.points.map((point) => ({ ...point }));
  }

  /**
   * 删除指定索引的打卡点
   * @param {number} index
   */
  removePointAt(index) {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error("打卡点索引不合法");
    }
    if (index >= this.points.length) {
      throw new Error("打卡点索引超出范围");
    }
    this.points.splice(index, 1);
    if (this.editIndex >= index) {
      this.editIndex = Math.max(this.editIndex - 1, -1);
    }
  }

  /**
   * 将打卡点插入到当前指针的下一个位置
   * @param {{ name?: string, longitude: number, latitude: number }} point
   */
  insertPointAfterEditIndex(point) {
    if (!point) {
      throw new Error("point 不能为空");
    }

    if (!Number.isInteger(this.editIndex) || this.editIndex < -1) {
      throw new Error("插入指针不合法");
    }
    if (this.editIndex >= this.points.length) {
      throw new Error("插入指针超出范围");
    }

    const longitude = Number(point?.longitude ?? point?.lng ?? point?.lon);
    const latitude = Number(point?.latitude ?? point?.lat);

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      throw new Error("打卡点经纬度不合法");
    }

    const insertIndex = this.editIndex + 1;
    this.points.splice(insertIndex, 0, {
      name: String(point?.name || `Checkpoint ${insertIndex + 1}`),
      longitude,
      latitude,
    });
    this.editIndex = insertIndex;
  }

  /**
   * 修改指定索引的打卡点名称
   * @param {number} index
   * @param {string} name
   */
  updatePointName(index, name) {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error("打卡点索引不合法");
    }
    if (index >= this.points.length) {
      throw new Error("打卡点索引超出范围");
    }
    this.points[index].name = String(name || "").trim();
  }

  /**
   * 清空所有打卡点并重置指针
   */
  clear() {
    this.points = [];
    this.editIndex = -1;
  }
}

export default PointManager;

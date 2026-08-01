// WorkTask là danh mục loại công việc tĩnh (vd "Khảo sát", "Lắp đặt", "Thu hồi").
// Nguồn: D:\bnwems-backend-api prisma/schema.prisma (model WorkTask).

export interface WorkTask {
  taskId: string;
  taskCode: string;
  taskName: string;
  description?: string;
  isActive: boolean;
}

export interface GetWorkTasksQuery {
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateWorkTaskBody {
  taskCode: string;
  taskName: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateWorkTaskBody {
  taskCode?: string;
  taskName?: string;
  description?: string;
  isActive?: boolean;
}

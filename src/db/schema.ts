// 数据库模型定义
export interface Database {
    user: {
        user_id: number;
        image?: string;
        github_id: string;
        profile: string;
        name: string;
        email: string;
        create_time: Date;
        update_time: Date;
    };
    user_current_plan: {
        user_id: number;
        current_plan: any;
    };
} 
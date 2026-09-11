export interface UserSession {
    token: string;
    email: string;
    username: string;
    created_at: string;
}
export interface AuthError {
    code: string;
    message: string;
}

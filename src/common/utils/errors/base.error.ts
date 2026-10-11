export default abstract class AppError extends Error {
	public statusCode: number;
	public resData: any;
	public methodName?: string;

	constructor(message: string, statusCode: number, resData: any = {}, methodName?: string) {
		super(message);

		this.statusCode = statusCode;
		this.resData = resData;
		this.methodName = methodName;

		Object.setPrototypeOf(this, new.target.prototype);
	}
}

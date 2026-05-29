declare module "supertest" {
  type Response = {
    body: Record<string, unknown>;
    status: number;
  };

  type TestRequest = Promise<Response> & {
    set(headers: Record<string, string>): TestRequest;
    send(body: unknown): TestRequest;
    query(query: Record<string, unknown>): TestRequest;
    expect(status: number): Promise<Response>;
  };

  type Agent = {
    get(path: string): TestRequest;
    post(path: string): TestRequest;
    patch(path: string): TestRequest;
    delete(path: string): TestRequest;
  };

  export default function request(server: unknown): Agent;
}

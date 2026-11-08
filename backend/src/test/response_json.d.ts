// The tests read response bodies without declaring their shape, so `json()` is `any` here where
// Node's own types make it `unknown`. Nothing outside the tests calls it.
interface Response {
  // oxlint-disable-next-line typescript/no-explicit-any -- what this file is for
  json(): Promise<any>;
}

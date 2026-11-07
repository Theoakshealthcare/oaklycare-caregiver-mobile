/**
 * A response captured against the running backend by `backend/scripts/capture_patient_flow.py`
 * (copied from `backend/docs/fe-captures/patient/`, placeholder data). Tests answer with these bodies so the app is
 * proven against the real shapes, not against shapes typed from the schema.
 */
export function capture(name: string): { status: number; body: any } {
  const file = require(`./captures/${name}.json`);
  return { status: file.response.status_code, body: file.response.body };
}

/** A handler that answers with one capture, optionally edited. */
export const answer = (name: string, edit?: (body: any) => any) => () => {
  const { status, body } = capture(name);
  return { status, body: edit ? edit(body) : body };
};

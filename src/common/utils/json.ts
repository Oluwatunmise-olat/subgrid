export const extractJson = (text: string): string => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;

  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");

  return start !== -1 && end > start ? body.slice(start, end + 1) : body;
};

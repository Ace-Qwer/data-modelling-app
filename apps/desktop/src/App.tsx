import type { Model } from '@dm/core';

export function App({ model }: { model: Model }) {
  return (
    <ul>
      {model.elements().map((element) => (
        <li key={element.id}>{element.name}</li>
      ))}
    </ul>
  );
}

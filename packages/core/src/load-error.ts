// Messages are shown to the user when a project cannot be opened.
export class ModelLoadError extends Error {
  override readonly name = 'ModelLoadError';
}

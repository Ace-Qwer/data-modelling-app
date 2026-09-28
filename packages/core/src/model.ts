export interface Element {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
}

export interface AddElement {
  readonly type: 'AddElement';
  readonly element: Element;
}

export type Command = AddElement;

export class Model {
  readonly #elements = new Map<string, Element>();
  readonly #done: Command[] = [];
  readonly #undone: Command[] = [];

  execute(command: Command): void {
    this.#apply(command);
    this.#done.push(command);
    this.#undone.length = 0;
  }

  undo(): void {
    const command = this.#done.pop();
    if (!command) return;
    this.#revert(command);
    this.#undone.push(command);
  }

  redo(): void {
    const command = this.#undone.pop();
    if (!command) return;
    this.#apply(command);
    this.#done.push(command);
  }

  getElement(id: string): Element | undefined {
    return this.#elements.get(id);
  }

  elements(): readonly Element[] {
    return [...this.#elements.values()];
  }

  #apply(command: Command): void {
    if (this.#elements.has(command.element.id)) {
      throw new Error(`Element ${command.element.id} already exists`);
    }
    this.#elements.set(command.element.id, command.element);
  }

  #revert(command: Command): void {
    this.#elements.delete(command.element.id);
  }
}

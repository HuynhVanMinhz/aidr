import { Fragment, useId } from 'react';
import type { ProductVariant, ProductVariantOption } from '../../types/catalog';
import {
  applyValue,
  valueStatesForOption,
  type VariantSelection,
  type VariantValueState,
} from '../../utils/productVariants';
import { isSwatchAxis, swatchColor } from '../../utils/variantSwatches';

type Props = {
  options: ProductVariantOption[];
  variants: ProductVariant[];
  selection: VariantSelection;
  onChange: (selection: VariantSelection) => void;
  disabled?: boolean;
};

/**
 * The configuration picker, built on the theme's own product-single markup: colour axes use
 * the round `.color-variant` swatches, every other axis uses the `.product-single-item-size`
 * pills. Both are radio-driven, so `input:checked + label` does the styling exactly as the
 * theme intends and only the fill colour is supplied from the data.
 *
 * Two states the theme has no markup for are added on top: a value no variant offers
 * alongside the current selection, and one that exists but is sold out.
 */
export function ProductVariantPicker({ options, variants, selection, onChange, disabled }: Props) {
  // Radios are grouped by `name` and matched by `for`/`id`, so both have to be unique on a
  // page that may show more than one picker.
  const uid = useId().replace(/:/g, '');

  if (options.length === 0) return null;

  function pick(option: ProductVariantOption, value: string) {
    onChange(applyValue(options, variants, selection, option.name, value));
  }

  function hint(option: ProductVariantOption, state: VariantValueState): string | undefined {
    if (state.unavailable) return `${option.name} ${state.value} is not available in this combination`;
    if (state.outOfStock) return `${option.name} ${state.value} is out of stock`;
    return undefined;
  }

  return (
    <>
      {options.map((option, axisIndex) => {
        const states = valueStatesForOption(option, variants, selection);
        const chosen = selection[option.name];
        const group = `variant-${uid}-${axisIndex}`;
        const asSwatches = isSwatchAxis(option);

        const heading = (
          <h3>
            {option.name}:
            {/* A swatch cannot name itself, so the chosen value is spelled out beside it. */}
            {chosen ? <span className="variant-axis__chosen">{chosen}</span> : null}
          </h3>
        );

        if (asSwatches) {
          return (
            <div className="product-single-item-color variant-axis" key={option.name}>
              {heading}
              <div className="product-item-variant-colors">
                {states.map((state, valueIndex) => {
                  const id = `${group}-${valueIndex}`;
                  const fill = swatchColor(state.value)!;
                  const classes = [
                    'color-variant',
                    state.unavailable ? 'is-unavailable' : '',
                    state.outOfStock ? 'is-out-of-stock' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    // No wrapper element: the theme sizes .color-variant as a flex item of
                    // .product-item-variant-colors, and a label nested one level deeper would
                    // stay inline and ignore its 30px box.
                    <Fragment key={state.value}>
                      <input
                        type="radio"
                        id={id}
                        name={group}
                        checked={chosen === state.value}
                        disabled={disabled || state.unavailable}
                        onChange={() => pick(option, state.value)}
                      />
                      <label
                        htmlFor={id}
                        className={classes}
                        style={{ background: fill }}
                        title={hint(option, state) ?? state.value}
                        aria-label={`${option.name} ${state.value}`}
                      />
                    </Fragment>
                  );
                })}
              </div>
            </div>
          );
        }

        return (
          <div className="product-single-item-size variant-axis" key={option.name}>
            {heading}
            <ul>
              {states.map((state, valueIndex) => {
                const id = `${group}-${valueIndex}`;
                const classes = [
                  state.unavailable ? 'is-unavailable' : '',
                  state.outOfStock ? 'is-out-of-stock' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <li key={state.value}>
                    <input
                      type="radio"
                      id={id}
                      name={group}
                      value={state.value}
                      checked={chosen === state.value}
                      disabled={disabled || state.unavailable}
                      onChange={() => pick(option, state.value)}
                    />
                    <label htmlFor={id} className={classes} title={hint(option, state)}>
                      {state.value}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </>
  );
}

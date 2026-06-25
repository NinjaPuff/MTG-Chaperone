import {

  buildConnectorPath,

  collectBracketConnectors,

  connectorStroke,

  isVirtualDropNode,

  resolveDropAnchor,

} from './connectorEdges';

import type { PositionedSlot } from './layoutBracket';



type BracketConnectorsProps = {

  slots: PositionedSlot[];

  nodeWidth: number;

  nodeHeight: number;

};



export function BracketConnectors({ slots, nodeWidth, nodeHeight }: BracketConnectorsProps) {

  const slotByKey = new Map(slots.map((slot) => [slot.slotKey, slot]));

  const edges = collectBracketConnectors(slots);



  return (

    <svg className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">

      {edges.map((edge) => {

        const toSlot = slotByKey.get(edge.toSlotKey);

        if (!toSlot) {

          return null;

        }



        const fromSlot = slotByKey.get(edge.fromSlotKey);

        const startOverride =

          isVirtualDropNode(edge.fromSlotKey) && toSlot

            ? resolveDropAnchor(edge.fromSlotKey, toSlot, nodeHeight)

            : undefined;



        if (!fromSlot && !startOverride) {

          return null;

        }



        const stroke = connectorStroke(edge.kind);

        return (

          <path

            key={edge.id}

            data-testid="bracket-connector"

            data-connector-kind={edge.kind}

            d={buildConnectorPath(

              fromSlot ?? toSlot,

              toSlot,

              edge.kind,

              nodeWidth,

              nodeHeight,

              startOverride,

            )}

            fill="none"

            stroke="currentColor"

            strokeWidth={1.5}

            strokeDasharray={stroke.dashed ? '5 4' : undefined}

            className={edge.kind === 'reset' ? 'text-muted-foreground/70' : 'text-border'}

          />

        );

      })}

    </svg>

  );

}



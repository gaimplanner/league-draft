import type { CreateTemplateData } from '../../types';

/**
 * Standard Little League evaluation template preset.
 * Used as a starting point when admin clicks "Start from preset".
 *
 * Returns fresh UUIDs each invocation so that each template instance
 * gets unique identifiers for stations, fields, and categories.
 */
export const STANDARD_TRYOUT_PRESET = 'Standard Little League Tryout';

export function getStandardPreset(): CreateTemplateData {
  return {
    name: STANDARD_TRYOUT_PRESET,
    description: 'Standard Little League tryout evaluation with 5 stations and coach review categories.',
    stations: [
      {
        id: crypto.randomUUID(),
        name: 'Infield',
        order: 1,
        fields: [
          {
            id: crypto.randomUUID(),
            name: 'Ground Balls',
            type: 'count',
            min: 0,
            max: 3,
            description: 'Successful ground ball fielding out of 3',
          },
          {
            id: crypto.randomUUID(),
            name: 'Throw Accuracy',
            type: 'scale',
            min: 1,
            max: 5,
            anchors: {
              '1': 'Cannot throw to base',
              '3': 'Average throw, reaches base',
              '5': 'Strong, accurate throw consistently',
            },
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        name: 'Base Running',
        order: 2,
        fields: [
          {
            id: crypto.randomUUID(),
            name: '120ft Sprint',
            type: 'time',
            min: 0,
            max: 30,
            unit: 'seconds',
            lowerIsBetter: true,
            description: 'Time to run 2x60ft (home to second)',
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        name: 'Fly Balls',
        order: 3,
        fields: [
          {
            id: crypto.randomUUID(),
            name: 'Catches',
            type: 'count',
            min: 0,
            max: 3,
            description: 'Successful fly ball catches out of 3',
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        name: 'Pitching',
        order: 4,
        fields: [
          {
            id: crypto.randomUUID(),
            name: 'Accuracy',
            type: 'scale',
            min: 1,
            max: 5,
            anchors: {
              '1': 'Cannot find the strike zone',
              '3': 'Some strikes, inconsistent',
              '5': 'Consistently hits target',
            },
          },
          {
            id: crypto.randomUUID(),
            name: 'Form',
            type: 'scale',
            min: 1,
            max: 5,
            anchors: {
              '1': 'No recognizable form',
              '3': 'Basic mechanics present',
              '5': 'Excellent mechanics, repeatable motion',
            },
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        name: 'Hitting',
        order: 5,
        fields: [
          {
            id: crypto.randomUUID(),
            name: 'Contact',
            type: 'count',
            min: 0,
            max: 5,
            description: 'Solid contact out of 5 machine pitches',
          },
          {
            id: crypto.randomUUID(),
            name: 'Power',
            type: 'scale',
            min: 1,
            max: 5,
            anchors: {
              '1': 'No power, taps only',
              '3': 'Moderate power, reaches outfield grass',
              '5': 'Strong power, clears outfield',
            },
          },
        ],
      },
    ],
    coachCategories: [
      // Physical categories
      {
        id: crypto.randomUUID(),
        name: 'Fielding',
        type: 'physical',
        min: 1,
        max: 5,
        anchors: {
          '1': 'Below expectations',
          '2': 'Needs improvement',
          '3': 'Meets expectations',
          '4': 'Above expectations',
          '5': 'Exceptional',
        },
      },
      {
        id: crypto.randomUUID(),
        name: 'Hitting',
        type: 'physical',
        min: 1,
        max: 5,
        anchors: {
          '1': 'Below expectations',
          '2': 'Needs improvement',
          '3': 'Meets expectations',
          '4': 'Above expectations',
          '5': 'Exceptional',
        },
      },
      {
        id: crypto.randomUUID(),
        name: 'Running',
        type: 'physical',
        min: 1,
        max: 5,
        anchors: {
          '1': 'Below expectations',
          '2': 'Needs improvement',
          '3': 'Meets expectations',
          '4': 'Above expectations',
          '5': 'Exceptional',
        },
      },
      {
        id: crypto.randomUUID(),
        name: 'Pitching',
        type: 'physical',
        min: 1,
        max: 5,
        anchors: {
          '1': 'Below expectations',
          '2': 'Needs improvement',
          '3': 'Meets expectations',
          '4': 'Above expectations',
          '5': 'Exceptional',
        },
      },
      {
        id: crypto.randomUUID(),
        name: 'Catching',
        type: 'physical',
        min: 1,
        max: 5,
        anchors: {
          '1': 'Below expectations',
          '2': 'Needs improvement',
          '3': 'Meets expectations',
          '4': 'Above expectations',
          '5': 'Exceptional',
        },
      },
      // Soft skill categories
      {
        id: crypto.randomUUID(),
        name: 'Baseball IQ',
        type: 'soft',
        min: 1,
        max: 5,
        anchors: {
          '1': 'Does not understand game situations',
          '3': 'Good awareness',
          '5': 'Anticipates plays, makes smart decisions',
        },
      },
      {
        id: crypto.randomUUID(),
        name: 'Hustle',
        type: 'soft',
        min: 1,
        max: 5,
        anchors: {
          '1': 'Low effort',
          '3': 'Consistent effort',
          '5': 'Maximum effort every play',
        },
      },
      {
        id: crypto.randomUUID(),
        name: 'Coachability',
        type: 'soft',
        min: 1,
        max: 5,
        anchors: {
          '1': 'Resistant to instruction',
          '3': 'Accepts feedback',
          '5': 'Actively seeks and applies feedback',
        },
      },
    ],
    blendWeights: {
      coachRating: 40,
      tryoutScore: 60,
    },
  };
}

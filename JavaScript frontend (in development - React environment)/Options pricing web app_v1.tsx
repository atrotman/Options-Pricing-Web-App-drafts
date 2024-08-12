"use client";

import { useState, useEffect, FC } from "react";
import dynamic from 'next/dynamic';
import { erf } from 'mathjs';

// Dynamically import HeatMap with SSR disabled, and assert the types
const HeatMap = dynamic(() => import('react-heatmap-grid'), {
  ssr: false,
}) as FC<{
  xLabels: string[];
  yLabels: string[];
  data: number[][];
  xLabelsLocation?: 'top' | 'bottom';
  xLabelWidth?: number;
  yLabelWidth?: number;
  labelStyle?: React.CSSProperties;
  squares?: boolean;
  height?: number;
  cellStyle?: (
    background: string,
    value: number,
    min: number,
    max: number
  ) => React.CSSProperties;
  cellRender?: (value: number) => string | JSX.Element;
  title?: (value: number, unit?: string) => string;
}>;

// Black-Scholes Model Function
const blackScholes = (
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  q: number
): { callPrice: number; putPrice: number } => {
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const callPrice = S * Math.exp(-q * T) * normalCdf(d1) - K * Math.exp(-r * T) * normalCdf(d2);
  const putPrice = K * Math.exp(-r * T) * normalCdf(-d2) - S * Math.exp(-q * T) * normalCdf(-d1);

  return { callPrice, putPrice };
};

// Binomial Tree Model Function
const binomialTree = (
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  q: number,
  N: number,
  optionType: string
): number => {
  const dt = T / N;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const p = (Math.exp((r - q) * dt) - d) / (u - d);

  let prices: number[] = [];
  for (let i = 0; i <= N; i++) {
    prices[i] = S * Math.pow(u, N - i) * Math.pow(d, i);
  }

  let optionPrices: number[] = prices.map((price) =>
    optionType === "call" ? Math.max(0, price - K) : Math.max(0, K - price)
  );

  for (let j = N - 1; j >= 0; j--) {
    for (let i = 0; i <= j; i++) {
      optionPrices[i] = Math.exp(-r * dt) * (p * optionPrices[i] + (1 - p) * optionPrices[i + 1]);
    }
  }

  return optionPrices[0];
};

// Normal CDF for Black-Scholes using `erf` from mathjs
function normalCdf(x: number): number {
  return (1.0 + erf(x / Math.sqrt(2.0))) / 2.0;
}

// Function to generate heatmap data
const generateHeatmapData = (
  model: string,
  inputs: {
    S: number;
    T: number;
    r: number;
    sigma: number;
    q: number;
    N: number;
  },
  strikePrices: number[],
  volatilities: number[]
): { callData: number[][]; putData: number[][] } => {
  const callData: number[][] = [];
  const putData: number[][] = [];

  for (let i = 0; i < volatilities.length; i++) {
    const callRow: number[] = [];
    const putRow: number[] = [];

    for (let j = 0; j < strikePrices.length; j++) {
      if (model === "Black-Scholes") {
        const { callPrice, putPrice } = blackScholes(
          inputs.S,
          strikePrices[j],
          inputs.T,
          inputs.r,
          volatilities[i],
          inputs.q
        );
        callRow.push(callPrice);
        putRow.push(putPrice);
      } else if (model === "Binomial Tree") {
        const callPrice = binomialTree(
          inputs.S,
          strikePrices[j],
          inputs.T,
          inputs.r,
          volatilities[i],
          inputs.q,
          inputs.N,
          "call"
        );
        const putPrice = binomialTree(
          inputs.S,
          strikePrices[j],
          inputs.T,
          inputs.r,
          volatilities[i],
          inputs.q,
          inputs.N,
          "put"
        );
        callRow.push(callPrice);
        putRow.push(putPrice);
      }
    }

    callData.push(callRow);
    putData.push(putRow);
  }

  return { callData, putData };
};

// Function to generate viridis colors for Color Scale Bars
const viridisColor = (value: number, min: number, max: number): string => {
  const scale = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const viridisColors = [
    [68, 1, 84], [71, 44, 122], [59, 81, 139], [44, 113, 142], [33, 144, 140],
    [39, 170, 121], [68, 192, 98], [110, 206, 74], [165, 218, 43], [253, 231, 37]
  ];
  const colorIndex = Math.floor(scale * (viridisColors.length - 1));
  const color = viridisColors[colorIndex] || viridisColors[0]; 
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
};

// Function to calculate brightness to determine text color
const getBrightness = (r: number, g: number, b: number): number => {
  return (r * 299 + g * 587 + b * 114) / 1000;
};

// Function to generate Color Scale Bar
const ColorBar = ({ min, max, height = 500 }: { min: number; max: number; height?: number }) => {
  const viridisColors = [
    [68, 1, 84], [71, 44, 122], [59, 81, 139], [44, 113, 142], [33, 144, 140],
    [39, 170, 121], [68, 192, 98], [110, 206, 74], [165, 218, 43], [253, 231, 37]
  ];

  const roundedMin = Math.ceil(min / 5) * 5;
  const roundedMax = Math.floor(max / 5) * 5;
  const steps = (roundedMax - roundedMin) / 5 + 1;

  const gradient = `linear-gradient(to top, ${viridisColors.map(color => `rgb(${color.join(',')})`).join(', ')})`;

  return (
    <div className="flex flex-col items-center">
      <div
        style={{
          background: gradient,
          height: `${height}px`,
          width: '20px',
          marginRight: '1000%',
          marginTop: '200%',
          marginBottom: '200%',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: `0%`,
            left: '100%',
            transform: 'translateX(10px)',
            fontSize: '12px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            transformOrigin: 'center',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '-10px',
              width: '8px',
              height: '1px',
              backgroundColor: 'black',
            }}
          />
          0
        </div>

        {[...Array(steps)].map((_, i) => {
          const value = roundedMin + i * 5;

          if (value === roundedMax) return null;

          const relativePosition = (value - min) / (max - min);
          const position = relativePosition * (height - 20);

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                bottom: `${position}px`,
                left: '100%',
                transform: 'translateX(10px)',
                fontSize: '12px',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                transformOrigin: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: '-10px',
                  width: '8px',
                  height: '1px',
                  backgroundColor: 'black',
                }}
              />
              {value}
            </div>
          );
        })}

        <div
          style={{
            position: 'absolute',
            top: `0%`,
            left: '100%',
            transform: 'translateX(10px)',
            fontSize: '12px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            transformOrigin: 'center',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '-10px',
              width: '8px',
              height: '1px',
              backgroundColor: 'black',
            }}
          />
          {roundedMax}
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  const [model, setModel] = useState('Black-Scholes');
  const [inputs, setInputs] = useState<{
    S: number;
    K_min: number;
    K_max: number;
    K_specific: number;
    T: number;
    r: number;
    sigma: number;
    q: number;
    N: number;
  }>({
    S: 100.42,
    K_min: 80.00,
    K_max: 120.00,
    K_specific: 93.45,
    T: 1.00,
    r: 0.05,
    sigma: 0.20,
    q: 0.00,
    N: 100,
  });

  const [results, setResults] = useState<{ callPrice?: number; putPrice?: number }>({});
  const [heatmapData, setHeatmapData] = useState<{ callData: number[][]; putData: number[][] }>({
    callData: Array(10).fill(Array(10).fill(0)),
    putData: Array(10).fill(Array(10).fill(0)),
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInputs((prev) => ({
      ...prev,
      [name]: parseFloat(value),
    }));
  };

  useEffect(() => {
    if (model === "Black-Scholes") {
      const { callPrice, putPrice } = blackScholes(
        inputs.S, inputs.K_specific, inputs.T, inputs.r, inputs.sigma, inputs.q
      );
      setResults({ callPrice, putPrice });
    } else if (model === "Binomial Tree") {
      const callPrice = binomialTree(
        inputs.S, inputs.K_specific, inputs.T, inputs.r, inputs.sigma, inputs.q, inputs.N, "call"
      );
      const putPrice = binomialTree(
        inputs.S, inputs.K_specific, inputs.T, inputs.r, inputs.sigma, inputs.q, inputs.N, "put"
      );
      setResults({ callPrice, putPrice });
    }
  
    const strikePrices = Array.from({ length: 10 }, (_, i) => (inputs.K_min + i * (inputs.K_max - inputs.K_min) / 9).toFixed(2));
    const volatilities = Array.from({ length: 10 }, (_, i) => ((inputs.sigma - 0.1) + i * 0.02).toFixed(2)).reverse();
  
    const { callData, putData } = generateHeatmapData(model, inputs, strikePrices.map(Number), volatilities.map(Number));
    setHeatmapData({ callData, putData });
  }, [model, inputs]);
  
  const inputLabels = {
    S: "Asset Price",
    K_min: "Minimum Strike Price",
    K_max: "Maximum Strike Price",
    K_specific: "Specific Strike Price",
    T: "Time to Maturity",
    r: "Interest Rate",
    sigma: "Implied Volatility",
    q: "Dividend Yield",
    N: "Number of Steps"
  };

  return (
    <main className="flex flex-col lg:flex-row min-h-screen p-8 bg-gray-100">
      {/* Left Side: Inputs */}
      <div className="w-full lg:w-1/5 p-4 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Select Model</h2>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full p-2 mb-4 border border-gray-300 rounded-lg"
        >
          <option value="Black-Scholes">Black-Scholes</option>
          <option value="Binomial Tree">Binomial Tree</option>
        </select>

        <h3 className="text-lg font-semibold mb-2">Input Parameters</h3>
        
        {Object.entries(inputs).map(([key, value]) => (
          <div key={key} className="mb-4">
            <label className="block text-gray-700 mb-1 text-sm">
              {inputLabels[key as keyof typeof inputs]}
            </label>
            <input
              type={key === "N" ? "number" : "number"}
              name={key}
              value={value}
              onChange={handleInputChange}
              step={key === "N" ? "1" : "0.01"}
              disabled={model === "Black-Scholes" && key === "N"} 
              className={`w-full p-2 border border-gray-300 rounded-lg text-sm ${
                model === "Black-Scholes" && key === "N" ? "bg-gray-200 cursor-not-allowed" : ""
              }`}
            />
          </div>
        ))}
      </div>

      {/* Right Side: Outputs */}
      <div className="w-full lg:w-4/5 pl-0 lg:pl-8 flex flex-col">
        <h2 className="text-2xl font-bold mb-4">{model} Option Pricing Heatmaps</h2>
        
        {/* New Message Box */}
        <div className="p-4 mb-4 rounded-lg" style={{ backgroundColor: '#e0f7fa', color: '#0077b6', fontWeight: 'bold', fontSize: '1.125rem' }}>
          Welcome! Explore how option prices move across different volatility levels and strike prices.
          Black-Scholes and Binomial Tree models are currently available with Finite Differences
          and Heston’s Stochastic Volatility coming soon.
        </div>

        {/* Call and Put Value Boxes */}
        <div className="flex flex-col lg:flex-row justify-between mb-8">
          <div className="flex flex-col items-center bg-green-100 text-green-800 p-4 rounded-lg shadow-md w-full lg:w-1/2 mb-4 lg:mb-0 lg:mr-4">
            <h3 className="text-lg font-semibold">Theoretical Call Price</h3>
            <p className="text-3xl font-bold">
              {results.callPrice !== undefined ? `$${results.callPrice.toFixed(2)}` : "Calculating..."}
            </p>
          </div>
          <div className="flex flex-col items-center bg-red-100 text-red-800 p-4 rounded-lg shadow-md w-full lg:w-1/2 lg:ml-4">
            <h3 className="text-lg font-semibold">Theoretical Put Price</h3>
            <p className="text-3xl font-bold">
              {results.putPrice !== undefined ? `$${results.putPrice.toFixed(2)}` : "Calculating..."}
            </p>
          </div>
        </div>

        {/* Heatmaps Section */}
        <div className="flex flex-col lg:flex-row gap-8 flex-wrap">
          <div className="flex-1 bg-white p-4 rounded-lg shadow-md w-full lg:max-w-full lg:max-h-full relative flex flex-col lg:flex-row overflow-x-auto">
            <div className="flex flex-col items-center w-full">
              <h3 className="text-lg font-semibold mb-2 text-center">CALL</h3> 
              <div className="flex items-center w-full">
                <div className="mr-2 h-full flex items-center justify-center">
                  <span className="transform -rotate-90 text-center text-sm">Volatility</span>
                </div>
                <div className="relative flex-grow">
                  <div className="flex flex-col items-center">
                    <HeatMap
                      xLabels={Array.from({ length: 10 }, (_, i) => (inputs.K_min + i * (inputs.K_max - inputs.K_min) / 9).toFixed(2))}
                      yLabels={Array.from({ length: 10 }, (_, i) => ((inputs.sigma - 0.1) + i * 0.02).toFixed(2)).reverse()}
                      xLabelsLocation="bottom"
                      xLabelWidth={40}
                      yLabelWidth={40}
                      labelStyle={{
                        fontSize: '0.8rem',
                      }}
                      data={heatmapData.callData}
                      squares
                      height={45} // This line can be omitted if you want height to be auto-adjusted
                      cellStyle={(
                        background: string, 
                        value: number, 
                        min: number, 
                        max: number
                      ): React.CSSProperties => {
                        const [r, g, b] = viridisColor(value, min, max)
                          .replace(/[^\d,]/g, '')
                          .split(',')
                          .map(Number);
                        const brightness = getBrightness(r, g, b);
                        return {
                          background: viridisColor(value, min, max),
                          color: brightness > 128 ? 'black' : 'white',
                          fontSize: '0.7rem',
                        };
                      }}
                      cellRender={(value: number) => value ? value.toFixed(2):''}
                      title={(value: number) => `${value}`}
                    />
                    <div className="text-center mt-2">
                      <span className="text-sm">Strike Price</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-none">
              <ColorBar min={Math.min(...heatmapData.callData.flat())} max={Math.max(...heatmapData.callData.flat())} height={450} />
            </div>
          </div>
          <div className="flex-1 bg-white p-4 rounded-lg shadow-md w-full lg:max-w-full lg:max-h-full relative flex flex-col lg:flex-row overflow-x-auto">
            <div className="flex flex-col items-center w-full">
              <h3 className="text-lg font-semibold mb-2 text-center">PUT</h3>
              <div className="flex items-center w-full">
                <div className="mr-2 h-full flex items-center justify-center">
                  <span className="transform -rotate-90 text-center text-sm">Volatility</span>
                </div>
                <div className="relative flex-grow">
                  <div className="flex flex-col items-center">
                    <HeatMap
                      xLabels={Array.from({ length: 10 }, (_, i) => (inputs.K_min + i * (inputs.K_max - inputs.K_min) / 9).toFixed(2))}
                      yLabels={Array.from({ length: 10 }, (_, i) => ((inputs.sigma - 0.1) + i * 0.02).toFixed(2)).reverse()}
                      xLabelsLocation="bottom"
                      xLabelWidth={40}
                      yLabelWidth={40}
                      labelStyle={{
                        fontSize: '0.8rem',
                      }}
                      data={heatmapData.putData}
                      squares
                      height={45} // This line can be omitted if you want height to be auto-adjusted
                      cellStyle={(
                        background: string, 
                        value: number, 
                        min: number, 
                        max: number
                      ): React.CSSProperties => {
                        const [r, g, b] = viridisColor(value, min, max)
                          .replace(/[^\d,]/g, '')
                          .split(',')
                          .map(Number);
                        const brightness = getBrightness(r, g, b);
                        return {
                          background: viridisColor(value, min, max),
                          color: brightness > 128 ? 'black' : 'white',
                          fontSize: '0.7rem',
                        };
                      }}
                      cellRender={(value: number) => value ? value.toFixed(2) : ''}
                      title={(value: number) => `${value}`}
                    />
                    <div className="text-center mt-2">
                      <span className="text-sm">Strike Price</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-none">
              <ColorBar min={Math.min(...heatmapData.putData.flat())} max={Math.max(...heatmapData.putData.flat())} height={450} />
            </div>
          </div>
        </div>
      </div>

      {/* Inline CSS */}
      <style jsx>{`
        .flex-1 {
          flex: 1;
          min-width: 0;
        }
        .max-w-full {
          max-width: 100%;
        }
        .max-h-full {
          max-height: 100%;
        }
        .flex-grow {
          flex-grow: 1;
        }
        .text-right {
          text-align: right;
        }
        .cursor-not-allowed {
          cursor: not-allowed;
        }
        @media (max-width: 1024px) {
          .lg\:pl-8 {
            padding-left: 0;
          }
          .w-full, .w-4/5, .w-1/5 {
            width: 100%; /* Ensure full width on small screens */
          }
          .p-4, .mb-4 {
            padding: 0.5rem; /* Less padding on small screens */
            margin-bottom: 1rem;
          }
        }
        .transform {
          transform: rotate(-90deg);
        }
        .origin-left {
          transform-origin: left center.
        }
        .overflow-x-auto {
          overflow-x: auto;
        }
      `}</style>
    </main>
  );
}

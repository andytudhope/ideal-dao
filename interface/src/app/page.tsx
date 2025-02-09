"use client"

import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Above the fold */}
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <div className="mb-8">
          <Image
            src="/logo.png"
            alt="Ideal DAO Logo"
            width={120}
            height={120}
            priority
          />
        </div>
        <h1 className="text-5xl font-bold mb-4">
          Ideal DAO
        </h1>
        <p className="text-xl text-gray-600">
          The best way to fund creators
        </p>
      </div>

      {/* Below the fold */}
      <div className="max-w-2xl mx-auto px-4 pb-24">
        <h2 className="text-2xl font-bold mb-8 text-center">
          Simply a better way of doing DAOs.
        </h2>

        <div className="space-y-6">
          <p>
            Blockchains, used intelligently, do two things:
          </p>

          <ol className="list-decimal pl-6 space-y-2">
            <li>Move money freely.</li>
            <li>Create programs that enable more people to participate in the additional value that is created by virtue of money moving freely.</li>
          </ol>

          <p>
            IdealDAO is <a className='font-bold underline' href="https://github.com/andytudhope/ideal-dao/tree/main" target="_blank">made of two contracts</a> that do exactly that, and only that.
          </p>

          <p>
            Go ahead and create a proposal. Anyone can. Anyone can fund that proposal.
          </p>

          <p>
            All proposals are funded with DEAL, which you can purchase with all the most secure stablecoins. You can also redeem that DEAL for the underlying collateral at any time: there is no force or violence in IdealDAO.
          </p>

          <p className="text-xl font-medium text-center mt-12">
            Welcome to the future.
          </p>
        </div>
      </div>
    </div>
  );
}
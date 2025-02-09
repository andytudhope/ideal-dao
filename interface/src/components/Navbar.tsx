'use client'
import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import Image from 'next/image';

const navItems = [
  { name: 'Get Funded', href: '/submit' },
  { name: 'Get DEAL', href: '/deal' },
  { name: 'All Proposals', href: '/proposals' },
];

const Navbar = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { address, error, isConnecting, connect, disconnect, isConnected } = useWallet();

  const displayAddress = address ? 
    `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  return (
    <>
      {/* Main Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Left Section - Logo (hidden on mobile) */}
            <div className="hidden md:flex items-center">
              <Link 
                href="/"
              >
              <Image
                src="/logo.png"
                alt="Logo"
                width={120}
                height={40}
                className="h-8 w-auto"
              />
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>

            {/* Center Section - Navigation Items */}
            <div className="hidden md:flex items-center justify-center flex-1">
              <div className="flex space-x-8">
                {navItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right Section - Connect Button */}
            <div>
              {isConnected ? (
                <button
                  onClick={disconnect}
                  className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
                >
                  {displayAddress}
                </button>
              ) : (
                <button
                  onClick={connect}
                  disabled={isConnecting}
                  className={`bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium 
                    ${isConnecting ? 'opacity-75 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                >
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Show error if any */}
        {error && (
          <div className="bg-red-50 p-2 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </nav>

      {/* Sidedraw */}
      <div 
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${
          isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsDrawerOpen(false)}
      >
        <div
          className={`fixed inset-y-0 left-0 w-64 bg-white transform transition-transform duration-300 ease-in-out ${
            isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
            <Image
              src="/logo.png"
              alt="Logo"
              width={120}
              height={40}
              className="h-8 w-auto"
            />
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="py-4">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block px-4 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                onClick={() => setIsDrawerOpen(false)}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Spacer to prevent content from going under navbar */}
      <div className="h-16" />
    </>
  );
};

export default Navbar;
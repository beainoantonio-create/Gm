<ChevronRight className="w-6 h-6" />
                </button>
              )}

              {/* Thumbnail Bottom Bar */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-xl w-full px-4 hidden sm:flex items-center justify-center gap-1.5 overflow-x-auto py-2 bg-neutral-900/60 backdrop-blur-md rounded-xl border border-neutral-800">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedPhotoIndex(idx)}
                    className={`w-12 h-9 rounded-md overflow-hidden shrink-0 transition cursor-pointer border-2 ${
                      selectedPhotoIndex === idx ? 'border-white scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-7xl mx-auto w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedPhotoIndex(idx);
                      setGalleryMode('slideshow');
                    }}
                    className="aspect-[4/3] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-neutral-600 transition cursor-pointer group relative"
                  >
                    <img
                      src={img}
                      alt={`Grid photo ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-bold text-white backdrop-blur-xs">
                      {idx + 1}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    )}

    {/* Reservation & WhatsApp Confirmation Modal */}
    {showReservationModal && (
      <ReservationModal
        property={property}
        checkInDate={checkInDate}
        checkOutDate={checkOutDate}
        guestsCount={guestsCount}
        currencySymbol={currencySymbol}
        onClose={() => setShowReservationModal(false)}
      />
    )}
  </div>
);
};
